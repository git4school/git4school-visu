import { Injectable } from "@angular/core";
import { GithubAuthService } from "@services/github-auth.service";
import { BehaviorSubject, Observable } from "rxjs";
import { MOCK_GITHUB_ACTIVE_KEY, MOCK_GITHUB_TOKEN, getMockProfile } from "./mock-fixtures";

/**
 * DEV-ONLY service toggling the mocked GitHub session. Enabling it injects a fake
 * authenticated account (no Firebase popup) which pairs with MockGithubInterceptor
 * to serve fixture data. Activation is persisted so a reload keeps the session.
 */
@Injectable({
  providedIn: "root",
})
export class MockGithubInstanceService {
  public isMockActive$: Observable<boolean>;

  private readonly storageKey = MOCK_GITHUB_ACTIVE_KEY;
  private activeSubject: BehaviorSubject<boolean>;

  constructor(private githubAuthService: GithubAuthService) {
    this.activeSubject = new BehaviorSubject<boolean>(this.readSavedState());
    this.isMockActive$ = this.activeSubject.asObservable();
  }

  get isMockActive(): boolean {
    return this.activeSubject.getValue();
  }

  async toggleMock(): Promise<boolean> {
    if (this.isMockActive) {
      this.disableMock();
      return false;
    }
    this.enableMock();
    return true;
  }

  enableMock(): void {
    this.saveState(true);
    this.activeSubject.next(true);
    const profile = getMockProfile("github");
    this.githubAuthService.injectMockSession(MOCK_GITHUB_TOKEN, {
      username: profile.login,
      avatarUrl: profile.avatarUrl,
      displayName: profile.name,
    });
  }

  disableMock(): void {
    this.saveState(false);
    this.activeSubject.next(false);
    this.githubAuthService.clearMockSession();
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
