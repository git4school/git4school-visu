import { Injectable, OnDestroy, Optional } from "@angular/core";
import { BehaviorSubject, Observable, Subscription } from "rxjs";
import { GithubAuthService } from "@services/github-auth.service";
import { GitlabAuthService } from "@services/gitlab-auth.service";
import { GitlabCustomAuthService } from "@services/gitlab-custom-auth.service";
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
    @Optional() public gitlabCustomAuthService?: GitlabCustomAuthService,
    @Optional() public githubDataService?: GithubDataService,
    @Optional() public gitlabDataService?: GitlabDataService,
  ) {
    this.accounts$ = this.accountsSubject.asObservable();

    this.registerProvider(this.githubAuthService);
    this.registerProvider(this.gitlabAuthService);

    if (this.gitlabCustomAuthService?.accountsChange$) {
      this.authSubscription.add(
        this.gitlabCustomAuthService.accountsChange$.subscribe(() => {
          this.updateAccounts();
        }),
      );
    }

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
    const customCount = this.gitlabCustomAuthService?.getAccounts?.()?.length || 0;
    return this.gitlabAuthService.isSignedIn() || customCount > 0;
  }

  hasAccount(providerType: GitProviderType): boolean {
    if (providerType === "gitlab") {
      const customCount = this.gitlabCustomAuthService?.getAccounts?.()?.length || 0;
      return Boolean(this.gitlabAuthService.isSignedIn() || customCount > 0);
    }
    return Boolean(this.providers.get(providerType)?.isSignedIn());
  }

  hasAccountForHost(provider: GitProviderType, instanceHost?: string): boolean {
    if (provider === "github") {
      return this.githubAuthService.isSignedIn();
    }
    if (provider === "gitlab") {
      if (!instanceHost || instanceHost === "gitlab.com") {
        return this.gitlabAuthService.isSignedIn();
      }
      return !!this.gitlabCustomAuthService?.hasAccount?.(instanceHost);
    }
    return false;
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
      if (account.authType === "pat" || (account.provider === "gitlab" && account.instanceHost && account.instanceHost !== "gitlab.com")) {
        this.gitlabCustomAuthService?.disconnectInstance(account.instanceHost);
        return;
      }
      this.providers.get(account.provider)?.signOut();
      return;
    }

    const customMatch = this.gitlabCustomAuthService?.getAccounts?.()?.find((a) => a.id === id || a.instanceHost === id);
    if (customMatch) {
      this.gitlabCustomAuthService?.disconnectInstance(customMatch.instanceHost);
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
    const cleanHost = account.instanceHost ? account.instanceHost.replace(/^https?:\/\//i, "").replace(/\/.*$/, "") : "";
    const provider = account.provider ? this.providers.get(account.provider as GitProviderType) : undefined;
    if (account.provider === "gitlab" && cleanHost && cleanHost !== "gitlab.com" && this.gitlabCustomAuthService?.getProfileUrl) {
      return this.gitlabCustomAuthService.getProfileUrl(cleanHost, account.username);
    }
    if (provider && (!cleanHost || cleanHost === provider.instanceHost)) {
      return provider.getProfileUrl(account.username);
    }
    const fallbackHost = provider?.instanceHost || (account.provider === "gitlab" ? "gitlab.com" : "github.com");
    const host = cleanHost || fallbackHost;
    return `https://${host}/${encodeURIComponent(account.username)}`;
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
    const customAccounts = this.gitlabCustomAuthService?.getAccounts?.() || [];
    for (const cAcc of customAccounts) {
      cAcc.isCurrent = false;
      accounts.push(cAcc);
    }
    if (accounts.length > 0) {
      const primaryIdx = accounts.findIndex((a) => a.provider === "github");
      const activeIdx = primaryIdx >= 0 ? primaryIdx : 0;
      accounts[activeIdx].isCurrent = true;
    }
    this.accountsSubject.next(accounts);
  }
}
