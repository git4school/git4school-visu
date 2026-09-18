import { Injectable } from "@angular/core";
import { GitlabCustomAuthService } from "@services/gitlab-custom-auth.service";
import { BehaviorSubject, Observable } from "rxjs";

export const MOCK_GITLAB_HOST = "gitlab.univ-tlse3.fr";
export const MOCK_GITLAB_ALIAS = "UT3";
export const MOCK_GITLAB_TOKEN = "glpat-mock-turing-token-123";

@Injectable({
  providedIn: "root",
})
export class MockGitlabInstanceService {
  public isMockActive$: Observable<boolean>;

  private readonly storageKey = "g4s_dev_mock_gitlab_active";
  private activeSubject: BehaviorSubject<boolean>;

  constructor(private gitlabCustomAuthService: GitlabCustomAuthService) {
    const isInitiallyActive = this.readSavedState();
    this.activeSubject = new BehaviorSubject<boolean>(isInitiallyActive);
    this.isMockActive$ = this.activeSubject.asObservable();

    if (isInitiallyActive && !this.gitlabCustomAuthService.hasAccount(MOCK_GITLAB_HOST)) {
      this.activateAccount().catch((err) => {
        console.warn("[MockGitlabInstance] Auto-activation on init failed:", err);
      });
    }
  }

  get isMockActive(): boolean {
    return this.activeSubject.getValue();
  }

  async toggleMock(): Promise<boolean> {
    if (this.isMockActive) {
      await this.disableMock();
      return false;
    } else {
      await this.enableMock();
      return true;
    }
  }

  async enableMock(): Promise<void> {
    this.saveState(true);
    this.activeSubject.next(true);
    await this.activateAccount();
  }

  async disableMock(): Promise<void> {
    this.saveState(false);
    this.activeSubject.next(false);
    this.gitlabCustomAuthService.disconnectInstance(MOCK_GITLAB_HOST);
  }

  private async activateAccount(): Promise<void> {
    try {
      await this.gitlabCustomAuthService.connectInstance(`https://${MOCK_GITLAB_HOST}`, MOCK_GITLAB_TOKEN, MOCK_GITLAB_ALIAS, true);
    } catch (e) {
      console.error("[MockGitlabInstance] Failed to connect mock account:", e);
    }
  }

  private readSavedState(): boolean {
    try {
      return localStorage.getItem(this.storageKey) === "true";
    } catch {
      return false;
    }
  }

  private saveState(active: boolean): void {
    try {
      if (active) {
        localStorage.setItem(this.storageKey, "true");
      } else {
        localStorage.removeItem(this.storageKey);
      }
    } catch {
      /* Storage unavailable */
    }
  }
}
