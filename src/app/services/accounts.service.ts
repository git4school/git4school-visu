import { Injectable, OnDestroy } from "@angular/core";
import { BehaviorSubject, Observable, Subscription } from "rxjs";
import { AuthService } from "@services/auth.service";
import { Account } from "@models/Account.model";

@Injectable({
  providedIn: "root",
})
export class AccountsService implements OnDestroy {
  private accountsSubject = new BehaviorSubject<Account[]>([]);
  public accounts$: Observable<Account[]> = this.accountsSubject.asObservable();

  private authSubscription: Subscription;

  constructor(public authService: AuthService) {
    this.updateAccounts();

    this.authSubscription = this.authService.authChange$.subscribe(() => {
      this.updateAccounts();
    });
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  get currentAccounts(): Account[] {
    return this.accountsSubject.getValue();
  }

  get isGithubConnected(): boolean {
    return !!this.authService.isSignedIn();
  }

  private buildRealGithubAccount(): Account | null {
    if (!this.authService.isSignedIn()) {
      return null;
    }
    const username =
      this.authService.username ||
      localStorage.getItem("github_username") ||
      "github_user";
    const avatarUrl =
      this.authService.avatarUrl ||
      localStorage.getItem("github_avatar") ||
      `https://avatars.githubusercontent.com/${username}`;

    return {
      id: "acc-github-real",
      provider: "github",
      instanceHost: "github.com",
      username,
      avatarUrl,
      lastSync: "Connecté via Firebase",
      isCurrent: true,
    };
  }

  private updateAccounts(): void {
    const list: Account[] = [];
    const realGithub = this.buildRealGithubAccount();
    if (realGithub) {
      list.push(realGithub);
    }
    this.accountsSubject.next(list);
  }

  disconnectAccount(id: string): void {
    const target = this.currentAccounts.find((a) => a.id === id);
    if (target && (target.provider === "github" || id === "acc-github-real")) {
      this.authService.signOut();
    }
  }

  isEmpty(): boolean {
    return this.currentAccounts.length === 0;
  }

  getProfileUrl(
    account: Account | { instanceHost?: string; username?: string; provider?: string }
  ): string {
    if (!account || !account.username) {
      return "#";
    }
    const host =
      account.instanceHost ||
      (account.provider === "github" ? "github.com" : "gitlab.com");
    const cleanHost = host.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
    return `https://${cleanHost}/${encodeURIComponent(account.username)}`;
  }
}
