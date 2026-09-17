import { Injectable, OnDestroy, Optional } from "@angular/core";
import { BehaviorSubject, Observable, Subscription } from "rxjs";
import { GithubAuthService } from "@services/github-auth.service";
import { GitlabAuthService } from "@services/gitlab-auth.service";
import { GithubDataService } from "@services/github-data.service";
import { GitlabDataService } from "@services/gitlab-data.service";
import { Account, GitProviderType } from "@models/Account.model";
import { GitAuthProvider } from "@models/GitAuthProvider.model";
import { GitDataService } from "@models/GitDataService.model";

@Injectable({
  providedIn: "root",
})
export class AccountsService implements OnDestroy {
  public accounts$: Observable<Account[]>;

  private accountsSubject = new BehaviorSubject<Account[]>([]);
  private authSubscription = new Subscription();
  private providers = new Map<GitProviderType, GitAuthProvider>();
  private dataServices = new Map<GitProviderType, GitDataService>();

  constructor(
    public githubAuthService: GithubAuthService,
    public gitlabAuthService: GitlabAuthService,
    @Optional() public githubDataService?: GithubDataService,
    @Optional() public gitlabDataService?: GitlabDataService,
  ) {
    this.accounts$ = this.accountsSubject.asObservable();

    this.registerProvider(this.githubAuthService);
    this.registerProvider(this.gitlabAuthService);

    if (this.githubDataService) {
      this.dataServices.set("github", this.githubDataService);
    }
    if (this.gitlabDataService) {
      this.dataServices.set("gitlab", this.gitlabDataService);
    }

    this.updateAccounts();
  }

  get currentAccounts(): Account[] {
    return this.accountsSubject.getValue();
  }

  get isGithubConnected(): boolean {
    return this.githubAuthService.isSignedIn();
  }

  get isGitlabConnected(): boolean {
    return this.gitlabAuthService.isSignedIn();
  }

  hasAccount(providerType: GitProviderType): boolean {
    return Boolean(this.providers.get(providerType)?.isSignedIn());
  }

  getDataService(providerType: GitProviderType = "github"): GitDataService {
    const service = this.dataServices.get(providerType);
    if (!service) {
      return this.githubDataService;
    }
    return service;
  }

  ngOnDestroy(): void {
    this.authSubscription.unsubscribe();
  }

  getProvider(providerType: GitProviderType): GitAuthProvider | undefined {
    return this.providers.get(providerType);
  }

  disconnectAccount(id: string): void {
    const account = this.currentAccounts.find((a) => a.id === id);
    if (account) {
      this.providers.get(account.provider)?.signOut();
      return;
    }
    for (const provider of this.providers.values()) {
      if (id.includes(provider.provider)) {
        provider.signOut();
        return;
      }
    }
  }

  isEmpty(): boolean {
    return this.currentAccounts.length === 0;
  }

  getProfileUrl(account: Account | { instanceHost?: string; username?: string; provider?: string }): string {
    if (!account?.username) {
      return "#";
    }
    const provider = account.provider ? this.providers.get(account.provider as GitProviderType) : undefined;
    if (provider && (!account.instanceHost || account.instanceHost === provider.instanceHost)) {
      return provider.getProfileUrl(account.username);
    }
    const fallbackHost = provider?.instanceHost || (account.provider === "gitlab" ? "gitlab.com" : "github.com");
    const host = account.instanceHost || fallbackHost;
    const cleanHost = host.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
    return `https://${cleanHost}/${encodeURIComponent(account.username)}`;
  }

  private registerProvider(provider: GitAuthProvider): void {
    this.providers.set(provider.provider, provider);
    this.authSubscription.add(
      provider.authChange$.subscribe(() => {
        this.updateAccounts();
      }),
    );
  }

  private updateAccounts(): void {
    const accounts: Account[] = [];
    for (const provider of this.providers.values()) {
      const acc = provider.getAccount();
      if (acc) {
        acc.isCurrent = false;
        accounts.push(acc);
      }
    }
    if (accounts.length > 0) {
      const primaryIdx = accounts.findIndex((a) => a.provider === "github");
      const activeIdx = primaryIdx >= 0 ? primaryIdx : 0;
      accounts[activeIdx].isCurrent = true;
    }
    this.accountsSubject.next(accounts);
  }
}
