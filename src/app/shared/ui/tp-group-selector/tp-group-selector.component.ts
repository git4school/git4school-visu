import { Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild } from "@angular/core";
import { NgbDropdown } from "@ng-bootstrap/ng-bootstrap";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { Repository } from "@models/Repository.model";
import { OverlayManagerService, OverlayType } from "@services/overlay-manager.service";

/**
 * Sélecteur de groupe de TP : segment droit de la pill de contexte du devoir (navbar).
 *
 * Instance unique — le filtre est global au devoir et s'applique à toutes les vues via
 * `DataService.groupFilter$`. Le raccourci `G` (géré par la navbar) appelle `toggle()`.
 */
@Component({
  selector: "app-tp-group-selector",
  templateUrl: "./tp-group-selector.component.html",
  styleUrls: ["./tp-group-selector.component.scss"],
})
export class TpGroupSelectorComponent implements OnDestroy {
  @Input() groups: string[] = [];
  @Input() selected: string = null;
  @Input() repositories: Repository[] = [];

  @Output() selectedChange = new EventEmitter<string>();

  @ViewChild(NgbDropdown) private dropdown?: NgbDropdown;
  @ViewChild("tpGroupToggle") private toggleRef?: ElementRef<HTMLButtonElement>;

  private destroy$ = new Subject<void>();

  constructor(private elementRef: ElementRef<HTMLElement>, private overlayManagerService: OverlayManagerService) {
    /* Un autre overlay qui s'ouvre (panneau de séance, aide rapide…) ferme le menu. */
    this.overlayManagerService.dismiss$.pipe(takeUntil(this.destroy$)).subscribe((event) => {
      if (OverlayManagerService.shouldDismiss(OverlayType.DROPDOWN, event) && this.dropdown?.isOpen()) {
        this.dropdown.close();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Ouvre/ferme le menu et place le focus sur le groupe actif à l'ouverture. */
  toggle(): void {
    if (this.dropdown?.isOpen()) {
      this.dropdown.close();
      this.toggleRef?.nativeElement.focus();
      return;
    }

    this.dropdown?.open();
    this.overlayManagerService.dismissTransient();
    /* Let the open class land before moving focus into the menu, so arrows can navigate. */
    setTimeout(() => {
      const menu = this.elementRef.nativeElement.querySelector(".tp-group-menu");
      if (!menu) {
        return;
      }
      const active = menu.querySelector<HTMLElement>(".dropdown-item.active");
      const first = menu.querySelector<HTMLElement>(".dropdown-item");
      (active || first)?.focus();
    });
  }

  select(group: string): void {
    this.selectedChange.emit(group);
  }

  countFor(group: string): number {
    return (this.repositories || []).filter((repository) => repository.tpGroup === group).length;
  }
}
