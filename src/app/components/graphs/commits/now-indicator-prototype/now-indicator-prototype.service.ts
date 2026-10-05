/* PROTOTYPE — temporary "now" indicator style switcher (A / F / G / none).
 * Dev-only, in-memory (no LocalStorage), removed once a variant is chosen.
 * See AGENTS.md §1 "Prototypes". */
import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { environment } from "@environments/environment";

export type NowIndicatorVariant = "A" | "G" | "none";

@Injectable({
  providedIn: "root",
})
export class NowIndicatorPrototypeService {
  readonly variant$: Observable<NowIndicatorVariant>;

  private readonly variantSubject = new BehaviorSubject<NowIndicatorVariant>("A");

  constructor() {
    this.variant$ = this.variantSubject.asObservable();
  }

  /** Prototype controls only exist in development builds. */
  get isActive(): boolean {
    return !environment.production;
  }

  get variant(): NowIndicatorVariant {
    return this.variantSubject.value;
  }

  setVariant(variant: NowIndicatorVariant): void {
    if (!this.isActive) {
      return;
    }
    this.variantSubject.next(variant);
  }
}
