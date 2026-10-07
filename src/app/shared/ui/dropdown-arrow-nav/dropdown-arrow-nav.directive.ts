import { Directive, ElementRef, HostListener, NgZone, OnDestroy, OnInit } from "@angular/core";
import { NgbDropdown } from "@ng-bootstrap/ng-bootstrap";
import { Subscription } from "rxjs";
import { take } from "rxjs/operators";

/**
 * Complète la navigation clavier des dropdowns ng-bootstrap.
 *
 * Flèche bas/haut depuis le toggle ouvre le menu, mais ng-bootstrap y tente un focus alors que
 * le menu est encore en `display: none` (change detection non passée) : le focus échoue
 * silencieusement et il faut appuyer une seconde fois pour atteindre le premier item.
 * On repose donc le focus après stabilisation de la zone, sur le menu réel :
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

    this.stableSubscription?.unsubscribe();
    this.stableSubscription = this.ngZone.onStable.pipe(take(1)).subscribe(() => {
      this.stableSubscription = null;
      if (!this.dropdown.isOpen()) {
        return;
      }
      const items = Array.from(this.menuElement?.querySelectorAll<HTMLElement>("[ngbDropdownItem]:not(.disabled)") ?? []);
      if (items.length === 0) {
        return;
      }
      items[focusLast ? items.length - 1 : 0].focus();
    });
  }

  ngOnInit(): void {
    // Référence capturée avant toute ouverture : reste valide même si `container="body"` déplace le menu.
    this.menuElement = this.elementRef.nativeElement.querySelector("[ngbDropdownMenu]");
  }

  ngOnDestroy(): void {
    this.stableSubscription?.unsubscribe();
  }
}
