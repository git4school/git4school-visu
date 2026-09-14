import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { environment } from "../../environments/environment";

export interface DevFlagsState {
  gitlabCloudEnabled: boolean;
  gitlabCustomEnabled: boolean;
}

const STORAGE_KEY = "git4school_dev_flags";

const DEFAULT_FLAGS: DevFlagsState = {
  gitlabCloudEnabled: false,
  gitlabCustomEnabled: false,
};

@Injectable({
  providedIn: "root",
})
export class DevFlagsService {
  public gitlabCloudEnabled$: Observable<boolean>;
  public gitlabCustomEnabled$: Observable<boolean>;

  private gitlabCloudSubject = new BehaviorSubject<boolean>(false);
  private gitlabCustomSubject = new BehaviorSubject<boolean>(false);

  constructor() {
    this.gitlabCloudEnabled$ = this.gitlabCloudSubject.asObservable();
    this.gitlabCustomEnabled$ = this.gitlabCustomSubject.asObservable();
    this.initFlags();
  }

  get isProduction(): boolean {
    return !!environment.production;
  }

  get gitlabCloudEnabled(): boolean {
    if (environment.production) {
      return false;
    }
    return this.gitlabCloudSubject.value;
  }

  get gitlabCustomEnabled(): boolean {
    if (environment.production) {
      return false;
    }
    return this.gitlabCustomSubject.value;
  }

  toggleGitlabCloud(force?: boolean): void {
    if (environment.production) {
      return;
    }
    const nextVal =
      force !== undefined ? force : !this.gitlabCloudSubject.value;
    this.gitlabCloudSubject.next(nextVal);
    this.persist();
  }

  toggleGitlabCustom(force?: boolean): void {
    if (environment.production) {
      return;
    }
    const nextVal =
      force !== undefined ? force : !this.gitlabCustomSubject.value;
    this.gitlabCustomSubject.next(nextVal);
    this.persist();
  }

  resetFlags(): void {
    if (environment.production) {
      return;
    }
    this.gitlabCloudSubject.next(DEFAULT_FLAGS.gitlabCloudEnabled);
    this.gitlabCustomSubject.next(DEFAULT_FLAGS.gitlabCustomEnabled);
    this.persist();
  }

  private initFlags(): void {
    if (environment.production) {
      this.gitlabCloudSubject.next(false);
      this.gitlabCustomSubject.next(false);
      return;
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.gitlabCloudSubject.next(!!parsed.gitlabCloudEnabled);
        this.gitlabCustomSubject.next(!!parsed.gitlabCustomEnabled);
        return;
      }
    } catch (e) {
      /* Ignore parse errors in dev */
    }

    this.gitlabCloudSubject.next(DEFAULT_FLAGS.gitlabCloudEnabled);
    this.gitlabCustomSubject.next(DEFAULT_FLAGS.gitlabCustomEnabled);
  }

  private persist(): void {
    if (environment.production) {
      return;
    }
    const state: DevFlagsState = {
      gitlabCloudEnabled: this.gitlabCloudSubject.value,
      gitlabCustomEnabled: this.gitlabCustomSubject.value,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* Ignore quota errors */
    }
  }
}
