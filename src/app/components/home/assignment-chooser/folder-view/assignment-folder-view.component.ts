import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { Assignment } from "@models/Assignment.model";
import { TranslateService } from "@ngx-translate/core";
import { AssignmentsService } from "@services/assignments.service";
import { ClockService } from "@services/clock.service";
import { OverlayManagerService } from "@services/overlay-manager.service";
import { Utils } from "@services/utils";

/**
 * Vue « dossiers » de la liste des devoirs : une grille de dossiers dont la couleur
 * traduit le statut. Au survol, la feuille « métadonnées » sort légèrement du rabat
 * (l'autre reste cachée derrière) ; au clic, les deux feuilles A4 (métadonnées puis
 * planning) sortent entièrement côte à côte et les actions s'affichent dessous, le
 * reste de la grille passant derrière un flou de focalisation.
 *
 * Composant présentationnel : l'état de sélection et les actions restent gérés par
 * `AssignmentChooserComponent`.
 */
@Component({
  selector: "assignment-folder-view",
  templateUrl: "./assignment-folder-view.component.html",
  styleUrls: ["./assignment-folder-view.component.scss"],
})
export class AssignmentFolderViewComponent implements OnChanges {
  @Input() assignments: Assignment[] = [];
  @Input() selectionMode = false;
  @Input() selectedAssignments: Set<number> = new Set<number>();

  @Output() load = new EventEmitter<Assignment>();
  @Output() configure = new EventEmitter<Assignment>();
  @Output() delete = new EventEmitter<Assignment>();
  @Output() selectionToggle = new EventEmitter<number>();

  /** Dossier dont les feuilles sont sorties (un seul à la fois). */
  openAssignmentId: number | null = null;

  /** Dispositions « au repos » calculées par dossier (voir getRestLayout). */
  private readonly restLayouts = new Map<number, { [key: string]: string }>();

  constructor(
    public translateService: TranslateService,
    public assignmentsService: AssignmentsService,
    private clockService: ClockService,
    private overlayManager: OverlayManagerService,
    private elementRef: ElementRef<HTMLElement>,
  ) {}

  /**
   * Ferme le dossier ouvert dès qu'un clic tombe hors des dossiers. Les clics sur un
   * dossier restent gérés par ce dossier (fermeture, ou bascule directe vers un autre).
   */
  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent): void {
    if (this.openAssignmentId === null) {
      return;
    }
    const target = event.target as HTMLElement;
    if (!target || !target.isConnected) {
      return;
    }
    if (target.closest(".folder-item")) {
      return;
    }
    this.closeOpenFolder();
  }

  /** Échap referme le dossier ouvert. */
  @HostListener("document:keydown.escape")
  onEscape(): void {
    if (this.openAssignmentId !== null) {
      this.closeOpenFolder();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    /* Un rechargement de la base peut faire disparaître le dossier ouvert (suppression, import…). */
    if (changes.assignments && this.openAssignmentId !== null && !this.assignments.some((a) => a.id === this.openAssignmentId)) {
      this.openAssignmentId = null;
    }
  }

  trackByAssignmentId(index: number, item: any): any {
    return item?.id !== undefined ? item.id : index;
  }

  isOpen(assignment: any): boolean {
    return this.openAssignmentId === assignment.id;
  }

  isSelected(assignmentId: number): boolean {
    return this.selectedAssignments.has(assignmentId);
  }

  /**
   * Clic sur le rabat : en mode sélection, tout le dossier sélectionne/désélectionne ;
   * sinon il ouvre le dossier, le referme, ou bascule directement vers un autre.
   */
  toggleOpen(assignment: any): void {
    if (this.selectionMode) {
      this.selectionToggle.emit(assignment.id);
      return;
    }
    if (this.openAssignmentId === assignment.id) {
      this.closeOpenFolder();
      return;
    }
    this.openAssignmentId = assignment.id;
    this.overlayManager.dismissTransient();
    this.fitOpenFolderInView(assignment);
  }

  onSelectionToggle(assignmentId: number, event: MouseEvent): void {
    event.stopPropagation();
    this.selectionToggle.emit(assignmentId);
  }

  onLoad(assignment: any, event: MouseEvent): void {
    event.stopPropagation();
    this.load.emit(assignment);
  }

  onConfigure(assignment: any, event: MouseEvent): void {
    event.stopPropagation();
    this.closeOpenFolder();
    this.configure.emit(assignment);
  }

  onDelete(assignment: any): void {
    this.delete.emit(assignment);
  }

  isConnected(assignment: any): boolean {
    return this.assignmentsService.isAssignmentConnected(assignment);
  }

  getDisconnectedTooltip(assignment: any): string {
    return this.assignmentsService.getDisconnectedTooltip(assignment);
  }

  getAssignmentTooltip(assignment: any): string {
    return this.assignmentsService.getAssignmentTooltip(assignment);
  }

  getAssignmentEditTooltip(assignment: any): string {
    return this.assignmentsService.getAssignmentEditTooltip(assignment);
  }

  getAssignmentDeleteTooltip(assignment: any): string {
    return this.assignmentsService.getAssignmentDeleteTooltip(assignment);
  }

  getDuration(start: string, end: string): string {
    return Utils.getDuration(start, end, (key) => this.translateService.instant(key));
  }

  getRemainingTime(end: string): string {
    return Utils.getRemainingTime(end, this.clockService.moment(), (key) => this.translateService.instant(key));
  }

  formatDate(dateStr: string, format: string): string {
    return Utils.formatDate(dateStr, format, this.translateService.currentLang);
  }

  getProgressBarColor(progress: number): string {
    return Utils.getProgressBarColor(progress);
  }

  /**
   * Disposition « au repos » d'un dossier, légèrement randomisée (angles et décalages des
   * feuilles, placement et orientation du tampon de forge) pour éviter la monotonie de la
   * grille. Même devoir → même disposition (graine stable), mise en cache car appelée à
   * chaque détection de changements.
   */
  getRestLayout(assignment: any): { [key: string]: string } {
    const cached = this.restLayouts.get(assignment.id);
    if (cached) {
      return cached;
    }
    const layout = this.buildRestLayout(assignment);
    this.restLayouts.set(assignment.id, layout);
    return layout;
  }

  private closeOpenFolder(): void {
    this.openAssignmentId = null;
  }

  /** Petites variations déterministes autour des valeurs par défaut (graine = id + titre). */
  private buildRestLayout(assignment: any): { [key: string]: string } {
    const rand = (salt: number): number => {
      const source = `${assignment.id}:${assignment.title || ""}#${salt}`;
      let seed = 2166136261;
      for (let i = 0; i < source.length; i++) {
        seed = Math.imul(seed ^ source.charCodeAt(i), 16777619);
      }
      return ((seed >>> 0) % 2000) / 1000 - 1;
    };
    const tx1 = 10 + rand(1) * 1.4;
    /* La feuille de planning garde toujours 2,5 à 3,3 % d'avance : sa tranche reste visible. */
    const tx2 = tx1 + 2.5 + (rand(2) + 1) * 0.4;
    return {
      "--page-rot-1": `${(-2.2 + rand(3) * 1.1).toFixed(2)}deg`,
      "--page-rot-2": `${(2.6 + rand(4) * 1.1).toFixed(2)}deg`,
      "--page-tx-closed-1": `${tx1.toFixed(2)}%`,
      "--page-tx-closed-2": `${tx2.toFixed(2)}%`,
      "--page-ty-closed-1": `${(rand(5) * 1.1).toFixed(2)}%`,
      "--page-ty-closed-2": `${(rand(6) * 1.1).toFixed(2)}%`,
      "--stamp-dx": `${(rand(7) * 1.2).toFixed(2)}%`,
      "--stamp-dy": `${(rand(8) * 1.2).toFixed(2)}%`,
      "--stamp-rot": `${(-8 + rand(9) * 2.5).toFixed(2)}deg`,
    };
  }

  /**
   * Ramène le dossier ouvert dans la vue : les feuilles s'étendent vers la droite, un
   * dossier des dernières colonnes doit donc être décalé vers la gauche, puis on réserve
   * une marge basse pour que la rangée d'actions reste visible.
   */
  private fitOpenFolderInView(assignment: any): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById("assignment-folder-" + assignment.id);
        if (!el) {
          return;
        }
        this.applyOpenShift(el);
        el.style.setProperty("scroll-margin-top", "96px");
        el.style.setProperty("scroll-margin-bottom", "140px");
        el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      });
    });
  }

  /**
   * Décale la composition ouverte vers la gauche quand elle dépasse le bord droit de la
   * vue. La largeur ouverte vaut ≈ 220 % de la largeur du dossier avec la feuille de
   * planning (décalage 160 % × 80 % + position 10 % + largeur 80 %), et ≈ 134 % sans
   * elle (devoir non daté), sans jamais sortir du bord gauche.
   */
  private applyOpenShift(el: HTMLElement): void {
    el.style.removeProperty("--folder-open-shift");
    const stage = el.querySelector(".folder-stage") as HTMLElement;
    const stageWidth = stage ? stage.getBoundingClientRect().width : el.getBoundingClientRect().width;
    const itemRect = el.getBoundingClientRect();
    const hostRect = this.elementRef.nativeElement.getBoundingClientRect();
    const compositionRatio = el.querySelector(".folder-page--dates") ? 2.22 : 1.35;
    const compositionRight = itemRect.left + stageWidth * compositionRatio;
    let shift = Math.min(0, Math.round(hostRect.right - compositionRight));
    if (shift < 0) {
      /* Ne jamais pousser le rabat plus à gauche que le bord de la vue. */
      shift = Math.max(shift, Math.round(hostRect.left + 8 - itemRect.left));
    }
    if (shift !== 0) {
      el.style.setProperty("--folder-open-shift", shift + "px");
    }
  }
}
