import { Injectable, NgZone } from "@angular/core";
import { Observable, Subject } from "rxjs";

export enum OverlayType {
  ALL = "ALL",
  TOOLTIP = "TOOLTIP",
  CONTEXT_MENU = "CONTEXT_MENU",
  TYPEAHEAD = "TYPEAHEAD",
  QUICK_HELP = "QUICK_HELP",
  DROPDOWN = "DROPDOWN",
}

export interface DismissOptions {
  exclude?: OverlayType[];
  blurInput?: boolean;
}

export interface OverlayDismissEvent {
  target: OverlayType;
  options?: DismissOptions;
}

@Injectable({
  providedIn: "root",
})
export class OverlayManagerService {
  private dismissSubject = new Subject<OverlayDismissEvent>();

  public readonly dismiss$: Observable<OverlayDismissEvent> =
    this.dismissSubject.asObservable();

  constructor(private ngZone: NgZone) {}

  /**
   * Request dismissal of a specific overlay type.
   */
  public dismiss(type: OverlayType, options?: DismissOptions): void {
    this.ngZone.run(() => {
      this.dismissSubject.next({ target: type, options });
    });
  }

  /**
   * Request dismissal of all overlays, with optional exclusions.
   */
  public dismissAll(options?: DismissOptions): void {
    this.ngZone.run(() => {
      this.dismissSubject.next({ target: OverlayType.ALL, options });
    });
  }

  /**
   * Request dismissal of transient UI overlays (tooltips, contextual menus).
   */
  public dismissTransient(options?: DismissOptions): void {
    this.ngZone.run(() => {
      this.dismiss(OverlayType.TOOLTIP, options);
      this.dismiss(OverlayType.CONTEXT_MENU, options);
    });
  }

  /**
   * Helper utility to check if an event matches and should dismiss a target type.
   */
  public static shouldDismiss(
    type: OverlayType,
    event: OverlayDismissEvent
  ): boolean {
    if (event.options?.exclude?.includes(type)) {
      return false;
    }
    return event.target === OverlayType.ALL || event.target === type;
  }
}
