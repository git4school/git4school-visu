import { Injectable, OnDestroy } from "@angular/core";
import { BehaviorSubject, Observable, Subscription } from "rxjs";
import { AuthService } from "@services/auth.service";
import { Account } from "@models/Account.model";

@Injectable({
  providedIn: "root",
})
export class AccountsService implements OnDestroy {
  public accounts$: Observable<Account[]>;

  private accountsSubject = new BehaviorSubject<Account[]>([]);
  private authSubscription: Subscription;

  constructor(public authService: AuthService) {
    this.accounts$ = this.accountsSubject.asObservable();
    this.updateAccounts();

    this.authSubscription = this.authService.authChange$.subscribe(() => {
      this.updateAccounts();
    });
  }

  get currentAccounts(): Account[] {
    return this.accountsSubject.getValue();
  }

  get isGithubConnected(): boolean {
    return !!this.authService.isSignedIn();
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
  }

  disconnectAccount(id: string): void {
    const isGithub = id === "acc-github-real" || this.currentAccounts.some((a) => a.id === id && a.provider === "github");
    if (isGithub) {
      this.authService.signOut();
    }
  }

  isEmpty(): boolean {
    return this.currentAccounts.length === 0;
  }

  getProfileUrl(account: Account | { instanceHost?: string; username?: string; provider?: string }): string {
    if (!account?.username) {
      return "#";
    }
    const fallbackHost = account.provider === "gitlab" ? "gitlab.com" : "github.com";
    const host = account.instanceHost || fallbackHost;
    const cleanHost = host.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
    return `https://${cleanHost}/${encodeURIComponent(account.username)}`;
  }

  private buildRealGithubAccount(): Account | null {
    if (!this.authService.isSignedIn()) {
      return null;
    }
    const username = this.authService.username || "github_user";
    return {
      id: "acc-github-real",
      provider: "github",
      instanceHost: "github.com",
      username,
      avatarUrl: this.authService.avatarUrl || `https://avatars.githubusercontent.com/${username}`,
      lastSync: "Connecté via Firebase",
      isCurrent: true,
    };
  }

  private updateAccounts(): void {
    const realGithub = this.buildRealGithubAccount();
    this.accountsSubject.next(realGithub ? [realGithub] : []);
  }
}
