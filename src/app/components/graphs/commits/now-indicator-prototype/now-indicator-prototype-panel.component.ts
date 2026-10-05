/* PROTOTYPE — dev-only floating switcher for the "now" indicator variants.
 * Removed once a variant is chosen. See AGENTS.md §1 "Prototypes". */
import { Component } from "@angular/core";
import { NowIndicatorPrototypeService, NowIndicatorVariant } from "./now-indicator-prototype.service";

@Component({
  selector: "now-indicator-prototype-panel",
  templateUrl: "./now-indicator-prototype-panel.component.html",
  styleUrls: ["./now-indicator-prototype-panel.component.scss"],
})
export class NowIndicatorPanelPrototypeComponent {
  readonly variants: NowIndicatorVariant[] = ["A", "F", "G", "none"];

  constructor(public nowPrototype: NowIndicatorPrototypeService) {}

  get variant(): NowIndicatorVariant {
    return this.nowPrototype.variant;
  }

  select(variant: NowIndicatorVariant): void {
    this.nowPrototype.setVariant(variant);
  }

  variantLabel(variant: NowIndicatorVariant): string {
    return `PROTO.NOW.${variant === "none" ? "NONE" : variant}`;
  }
}
