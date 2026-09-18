import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { environment } from "../../environments/environment";

export interface DevFlagsState {
  gitlabCloudEnabled: boolean;
  gitlabCustomEnabled: boolean;
}

const STORAGE_KEY = "git4school_dev_flags";

const DEFAULT_FLAGS: DevFlagsState = {
  gitlabCloudEnabled: true,
  gitlabCustomEnabled: true,
};

@Injectable({
  providedIn: "root",
})
export class DevFlagsService {
  public gitlabCloudEnabled$: Observable<boolean>;
  public gitlabCustomEnabled$: Observable<boolean>;

  private gitlabCloudSubject = new BehaviorSubject<boolean>(true);
  private gitlabCustomSubject = new BehaviorSubject<boolean>(true);

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
    this.setFlag(this.gitlabCloudSubject, force);
  }

  toggleGitlabCustom(force?: boolean): void {
    this.setFlag(this.gitlabCustomSubject, force);
  }

  resetFlags(): void {
    if (!this.isProduction) {
      this.gitlabCloudSubject.next(DEFAULT_FLAGS.gitlabCloudEnabled);
      this.gitlabCustomSubject.next(DEFAULT_FLAGS.gitlabCustomEnabled);
      this.persist();
    }
  }

  private setFlag(subject: BehaviorSubject<boolean>, force?: boolean): void {
    if (!this.isProduction) {
      subject.next(force !== undefined ? force : !subject.value);
      this.persist();
    }
  }

  private initFlags(): void {
    if (this.isProduction) {
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      this.gitlabCloudSubject.next(!!saved.gitlabCloudEnabled);
      this.gitlabCustomSubject.next(!!saved.gitlabCustomEnabled);
    } catch {
      this.resetFlags();
    }
  }

  private persist(): void {
    if (this.isProduction) {
      return;
    }
    try {
      const state: DevFlagsState = {
        gitlabCloudEnabled: this.gitlabCloudSubject.value,
        gitlabCustomEnabled: this.gitlabCustomSubject.value,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* Ignore quota errors */
    }
  }
}
