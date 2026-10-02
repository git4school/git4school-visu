import { Injectable } from "@angular/core";
import * as moment from "moment";
import { BehaviorSubject, Observable } from "rxjs";
import { environment } from "@environments/environment";

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/**
 * Single source of truth for "what time is it, from the app's point of view".
 *
 * The real wall clock keeps ticking; a developer-defined offset (never persisted,
 * dev builds only) is added on top of it. Components that render dates MUST go
 * through this service instead of calling `Date.now()` / `new Date()` / `moment()`
 * directly, otherwise a simulated offset has no effect on them.
 */
@Injectable({
  providedIn: "root",
})
export class ClockService {
  public readonly offsetMs$: Observable<number>;

  private offsetMsSubject = new BehaviorSubject<number>(0);

  constructor() {
    this.offsetMs$ = this.offsetMsSubject.asObservable();
  }

  get isProduction(): boolean {
    return !!environment.production;
  }

  /** Current offset applied on top of the real clock, in milliseconds. */
  get offsetMs(): number {
    return this.isProduction ? 0 : this.offsetMsSubject.value;
  }

  get isShifted(): boolean {
    return this.offsetMs !== 0;
  }

  /** The real system time, ignoring any simulated offset. */
  realNow(): Date {
    return new Date();
  }

  /** The date the app should consider as "now", offset included. */
  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }

  /** moment equivalent of `now()`. */
  moment(): moment.Moment {
    return moment(this.now());
  }

  /** Move the simulated clock to an absolute instant. */
  setNow(target: Date | moment.Moment): void {
    if (this.isProduction) {
      return;
    }
    const targetMs = target instanceof Date ? target.getTime() : target.valueOf();
    this.offsetMsSubject.next(targetMs - Date.now());
  }

  /** Add a relative offset (negative shifts the clock into the past). */
  shift(deltaMs: number): void {
    if (this.isProduction) {
      return;
    }
    this.offsetMsSubject.next(this.offsetMsSubject.value + deltaMs);
  }

  reset(): void {
    if (this.isProduction) {
      return;
    }
    this.offsetMsSubject.next(0);
  }
}
