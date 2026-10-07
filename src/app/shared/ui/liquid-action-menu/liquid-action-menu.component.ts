import { Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, Output, ViewChild } from "@angular/core";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { OverlayManagerService, OverlayType } from "@services/overlay-manager.service";

/**
 * Menu d'actions secondaires « liquid morphism » : un bouton ellipsis dont les
 * gouttes se détachent au survol (filtre goo SVG global `#g4s-liquid-goo`).
 *
 * Ouverture : survol (desktop), clic (tactile), Entrée/Échap (clavier).
 * Les libellés des actions sont fournis par le parent (composant présentationnel).
 */
@Component({
  selector: "app-liquid-action-menu",
  templateUrl: "./liquid-action-menu.component.html",
  styleUrls: ["./liquid-action-menu.component.scss"],
})
export class LiquidActionMenuComponent implements OnDestroy {
  @Input() disabled = false;
  @Input() triggerTooltip = "";
  @Input() deleteTooltip = "";
  @Input() duplicateTooltip = "";
  @Input() archiveTooltip = "";

  @Output() delete = new EventEmitter<void>();
  @Output() duplicate = new EventEmitter<void>();
  @Output() archive = new EventEmitter<void>();
  @Output() openChange = new EventEmitter<boolean>();

  @ViewChild("triggerRef") private triggerRef?: ElementRef<HTMLButtonElement>;

  isOpen = false;
  isGulp = false;

  private destroy$ = new Subject<void>();
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private gulpTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private elementRef: ElementRef<HTMLElement>, private overlayManagerService: OverlayManagerService) {
    /* Un autre overlay qui s'ouvre (panneau de séance, aide rapide…) ferme le menu. */
    this.overlayManagerService.dismiss$.pipe(takeUntil(this.destroy$)).subscribe((event) => {
      if (this.isOpen && OverlayManagerService.shouldDismiss(OverlayType.DROPDOWN, event)) {
        this.close();
      }
    });
  }

  /** Un clic hors du composant ferme le menu (utile pour l'ouverture au clic/tactile). */
  @HostListener("document:pointerdown", ["$event"])
  onDocumentPointerDown(event: PointerEvent): void {
    if (this.isOpen && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  ngOnDestroy(): void {
    this.clearTimers();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Survole le déclencheur : ouverture immédiate. */
  onTriggerEnter(): void {
    this.open();
  }

  /** Quitte le groupe : fermeture différée pour laisser le temps d'atteindre une goutte. */
  onGroupLeave(): void {
    if (this.elementRef.nativeElement.contains(document.activeElement)) {
      return;
    }
    this.clearCloseTimer();
    this.closeTimer = setTimeout(() => this.close(), 60);
  }

  /** Clic sur le déclencheur : bascule (tactile et clavier). */
  onTriggerClick(event: Event): void {
    event.stopPropagation();
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /** Échap ferme le menu et rend le focus au déclencheur. */
  onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && this.isOpen) {
      this.close();
      this.triggerRef?.nativeElement.focus();
    }
  }

  onAction(action: "delete" | "duplicate" | "archive", event: Event): void {
    event.stopPropagation();
    if (action === "delete") {
      this.delete.emit();
    } else if (action === "duplicate") {
      this.duplicate.emit();
    } else {
      this.archive.emit();
    }
    this.close();
    this.triggerRef?.nativeElement.focus();
  }

  /** Fin du « gloup » de fermeture. */
  onBlobAnimationEnd(): void {
    this.isGulp = false;
  }

  /** Clic dans la zone vide du pont de survol : referme le menu. */
  onGroupClick(event: Event): void {
    if (!this.isOpen) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest(".item") || target.closest(".trigger")) {
      return;
    }
    this.close();
  }

  private open(): void {
    if (this.disabled || this.isOpen) {
      return;
    }
    this.clearTimers();
    this.isOpen = true;
    this.openChange.emit(true);
    this.overlayManagerService.dismissTransient();
  }

  private close(): void {
    if (!this.isOpen) {
      return;
    }
    this.clearCloseTimer();
    this.isOpen = false;
    this.openChange.emit(false);
    /* « Gloup » quand les gouttes sont ré-absorbées. */
    this.gulpTimer = setTimeout(() => {
      this.isGulp = true;
    }, 180);
  }

  private clearTimers(): void {
    this.clearCloseTimer();
    if (this.gulpTimer) {
      clearTimeout(this.gulpTimer);
      this.gulpTimer = null;
    }
  }

  private clearCloseTimer(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }
}
