import { Directive, ElementRef, HostListener, NgZone, OnDestroy, OnInit } from "@angular/core";
import { NgbDropdown } from "@ng-bootstrap/ng-bootstrap";
import { Subscription } from "rxjs";
import { take } from "rxjs/operators";

/**
 * Complète la navigation clavier des dropdowns ng-bootstrap.
 *
 * Flèche bas/haut depuis le toggle ouvre le menu, mais ng-bootstrap y focalise le premier item
 * alors que le menu est encore masqué (change detection non passée) : le focus échoue
 * silencieusement et il faut appuyer une seconde fois pour atteindre un item. Pire, si le menu
 * est déjà visible (toggle focalisé après un clic), ce focus intermédiaire réussit et la
 * sélection saute visiblement du premier au dernier item (flèche haut) avant de se stabiliser.
 * On repose donc le focus sur la cible réelle, immédiatement puis après stabilisation de la
 * zone :
 * - Flèche bas : ouvre et focus le premier item ;
 * - Flèche haut : ouvre et focus le dernier item.
 *
 * Une fois le menu ouvert, c'est ng-bootstrap qui gère le déplacement entre les items marqués
 * `ngbDropdownItem` (flèches, Home/End, Entrée).
 */
@Directive({
  selector: "[ngbDropdown]",
})
export class DropdownArrowNavDirective implements OnInit, OnDestroy {
  private menuElement: HTMLElement | null = null;
  private stableSubscription: Subscription | null = null;

  constructor(private dropdown: NgbDropdown, private elementRef: ElementRef<HTMLElement>, private ngZone: NgZone) {}

  @HostListener("keydown", ["$event"])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    const toggle = (event.target as HTMLElement).closest("[ngbDropdownToggle]");
    // Ne traiter que le toggle de ce dropdown, pas ceux des dropdowns imbriqués.
    if (!toggle || toggle.closest("[ngbDropdown]") !== this.elementRef.nativeElement) {
      return;
    }
    if (!this.menuElement) {
      return;
    }
    const focusLast = event.key === "ArrowUp";

    /* Si le menu est déjà visible (toggle focalisé après un clic), ng-bootstrap vient de
       focaliser le premier item dans ce même événement : on repose la cible immédiatement,
       avant toute frame, pour que la sélection n'y saute pas visiblement. Menu masqué : ce
       focus synchrone échoue silencieusement, le focus différé ci-dessous prend le relais. */
    this.focusEdgeItem(focusLast);

    this.stableSubscription?.unsubscribe();
    this.stableSubscription = this.ngZone.onStable.pipe(take(1)).subscribe(() => {
      this.stableSubscription = null;
      if (!this.dropdown.isOpen()) {
        return;
      }
      /* Ne repose la cible que si le focus synchrone a échoué (menu encore masqué) : le focus
         est alors toujours sur le toggle. Si un item est actif, l'utilisateur a pu bouger
         entre-temps (flèches rapides) et on ne doit pas le ramener en arrière. */
      if (toggle.ownerDocument.activeElement === toggle) {
        this.focusEdgeItem(focusLast);
      }
    });
  }

  ngOnInit(): void {
    // Référence capturée avant toute ouverture : reste valide même si `container="body"` déplace le menu.
    this.menuElement = this.elementRef.nativeElement.querySelector("[ngbDropdownMenu]");
  }

  ngOnDestroy(): void {
    this.stableSubscription?.unsubscribe();
  }

  private focusEdgeItem(focusLast: boolean): void {
    const items = Array.from(this.menuElement?.querySelectorAll<HTMLElement>("[ngbDropdownItem]:not(.disabled)") ?? []);
    if (items.length === 0) {
      return;
    }
    items[focusLast ? items.length - 1 : 0].focus();
  }
}
