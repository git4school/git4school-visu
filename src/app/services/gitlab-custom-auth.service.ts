import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { Account } from "@models/Account.model";
import { TokenStorageService } from "@services/token-storage.service";

export interface GitlabCustomUser {
  id: number;
  username: string;
  name: string;
  avatar_url: string;
  web_url: string;
}

export interface GitlabCustomUserData {
  user: GitlabCustomUser;
  alias?: string;
}

@Injectable({
  providedIn: "root",
})
export class GitlabCustomAuthService {
  public accountsChange$: Observable<Account[]>;

  private accountsSubject = new BehaviorSubject<Account[]>([]);
  private accounts: Account[] = [];

  constructor(private http: HttpClient, private tokenStorageService: TokenStorageService) {
    this.accountsChange$ = this.accountsSubject.asObservable();
    this.restoreSessions();
  }

  getAccounts(): Account[] {
    return [...this.accounts];
  }

  getAccount(instanceHost: string): Account | null {
    const cleanHost = this.cleanHostName(instanceHost);
    return this.accounts.find((a) => a.instanceHost === cleanHost) || null;
  }

  hasAccount(instanceHost: string): boolean {
    const cleanHost = this.cleanHostName(instanceHost);
    return this.accounts.some((a) => a.instanceHost === cleanHost);
  }

  normalizeUrl(rawUrl: string): { cleanUrl: string; host: string } {
    let trimmed = (rawUrl || "").trim();
    if (!trimmed) {
      return { cleanUrl: "", host: "" };
    }

    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }

    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      const origin = `${parsed.protocol}//${parsed.host}`;
      return {
        cleanUrl: origin,
        host,
      };
    } catch {
      const fallbackHost = trimmed
        .replace(/^https?:\/\//i, "")
        .replace(/\/.*$/, "")
        .toLowerCase();
      return {
        cleanUrl: `https://${fallbackHost}`,
        host: fallbackHost,
      };
    }
  }

  async connectInstance(url: string, pat: string, alias?: string, rememberMe = false): Promise<Account> {
    const { cleanUrl, host } = this.normalizeUrl(url);

    if (!host || host === "gitlab.com") {
      throw new Error("INVALID_HOST");
    }

    const cleanPat = (pat || "").trim();
    if (!cleanPat) {
      throw new Error("EMPTY_TOKEN");
    }

    const headers = new HttpHeaders({
      "PRIVATE-TOKEN": cleanPat,
    });

    let user: GitlabCustomUser;
    try {
      user = await this.http.get<GitlabCustomUser>(`${cleanUrl}/api/v4/user`, { headers }).toPromise();
    } catch (err: any) {
      const status = err?.status || err?.statusCode;
      if (status === 401 || status === 403) {
        throw new Error("INVALID_PAT");
      }
      throw new Error("SERVER_UNREACHABLE");
    }

    if (!user || !user.username) {
      throw new Error("INVALID_USER_DATA");
    }

    const instanceName = alias && alias.trim() ? alias.trim() : host;
    const account: Account = {
      id: `acc-gitlab-host-${host}`,
      provider: "gitlab",
      username: user.username,
      avatarUrl: user.avatar_url || null,
      instanceHost: host,
      instanceName,
      authType: "pat",
      isCurrent: false,
    };

    this.tokenStorageService.saveToken("gitlab", cleanPat, rememberMe, undefined, undefined, host);
    const userData: GitlabCustomUserData = {
      user,
      alias: instanceName,
    };
    this.tokenStorageService.saveUserData("gitlab", userData, rememberMe, host);

    const existingIndex = this.accounts.findIndex((a) => a.instanceHost === host);
    if (existingIndex >= 0) {
      this.accounts[existingIndex] = account;
    } else {
      this.accounts.push(account);
    }

    this.accountsSubject.next(this.getAccounts());
    return account;
  }

  disconnectInstance(instanceHost: string): void {
    const cleanHost = this.cleanHostName(instanceHost);
    this.tokenStorageService.clearAll("gitlab", cleanHost);
    this.accounts = this.accounts.filter((a) => a.instanceHost !== cleanHost);
    this.accountsSubject.next(this.getAccounts());
  }

  getProfileUrl(instanceHost: string, username?: string): string {
    const cleanHost = this.cleanHostName(instanceHost);
    if (!username) {
      return `https://${cleanHost}`;
    }
    return `https://${cleanHost}/${encodeURIComponent(username)}`;
  }

  private cleanHostName(host: string): string {
    return (host || "")
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .toLowerCase();
  }

  private restoreSessions(): void {
    const customHosts = this.tokenStorageService.getCustomGitlabHosts();
    const restoredAccounts: Account[] = [];

    for (const host of customHosts) {
      const token = this.tokenStorageService.getToken("gitlab", host);
      const data = this.tokenStorageService.getUserData<GitlabCustomUserData>("gitlab", host);

      if (token && data?.user?.username) {
        restoredAccounts.push({
          id: `acc-gitlab-host-${host}`,
          provider: "gitlab",
          username: data.user.username,
          avatarUrl: data.user.avatar_url || null,
          instanceHost: host,
          instanceName: data.alias || host,
          authType: "pat",
          isCurrent: false,
        });
      } else if (token || data) {
        this.tokenStorageService.clearAll("gitlab", host);
      }
    }

    this.accounts = restoredAccounts;
    this.accountsSubject.next(this.getAccounts());
  }
}
