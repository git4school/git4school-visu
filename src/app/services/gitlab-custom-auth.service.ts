import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, forkJoin, of } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { Account, TokenStatus } from "@models/Account.model";
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
  private tokenStatusMap = new Map<string, TokenStatus>();

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

  getTokenStatus(instanceHost: string): TokenStatus {
    const cleanHost = this.cleanHostName(instanceHost);
    return this.tokenStatusMap.get(cleanHost) || "unknown";
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

    let tokenExpiresInDays: number | null = null;
    try {
      const patData: any = await this.http.get(`${cleanUrl}/api/v4/personal_access_tokens/self`, { headers }).toPromise();
      if (patData?.expires_at) {
        const diffMs = new Date(patData.expires_at).getTime() - Date.now();
        tokenExpiresInDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      }
    } catch {
      /* Token self endpoint is optional on older GitLab versions */
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
      tokenStatus: "valid",
      tokenExpiresInDays,
    };

    this.tokenStatusMap.set(host, "valid");
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

  checkTokenValidity(instanceHost?: string): Observable<boolean> {
    if (instanceHost) {
      const cleanHost = this.cleanHostName(instanceHost);
      const token = this.tokenStorageService.getToken("gitlab", cleanHost);
      if (!token) {
        this.tokenStatusMap.set(cleanHost, "unknown");
        this.updateAccountStatus(cleanHost, "unknown");
        return of(false);
      }

      const headers = new HttpHeaders({
        "PRIVATE-TOKEN": token,
      });

      return this.http.get<GitlabCustomUser>(`https://${cleanHost}/api/v4/user`, { headers }).pipe(
        map(() => {
          this.tokenStatusMap.set(cleanHost, "valid");
          this.updateAccountStatus(cleanHost, "valid");
          return true;
        }),
        catchError((err) => {
          if (err?.status === 401 || err?.status === 403) {
            this.tokenStatusMap.set(cleanHost, "invalid");
            this.updateAccountStatus(cleanHost, "invalid");
          }
          return of(false);
        }),
      );
    }

    if (this.accounts.length === 0) {
      return of(true);
    }

    const checks = this.accounts.map((acc) => this.checkTokenValidity(acc.instanceHost));
    return forkJoin(checks).pipe(map((results) => results.every(Boolean)));
  }

  markTokenInvalid(instanceHost: string): void {
    const cleanHost = this.cleanHostName(instanceHost);
    if (this.tokenStatusMap.get(cleanHost) !== "invalid") {
      this.tokenStatusMap.set(cleanHost, "invalid");
      this.updateAccountStatus(cleanHost, "invalid");
    }
  }

  disconnectInstance(instanceHost: string): void {
    const cleanHost = this.cleanHostName(instanceHost);
    this.tokenStatusMap.delete(cleanHost);
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

  private updateAccountStatus(cleanHost: string, status: TokenStatus): void {
    const account = this.accounts.find((a) => a.instanceHost === cleanHost);
    if (account) {
      account.tokenStatus = status;
      this.accountsSubject.next(this.getAccounts());
    }
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
        this.tokenStatusMap.set(host, "unknown");
        restoredAccounts.push({
          id: `acc-gitlab-host-${host}`,
          provider: "gitlab",
          username: data.user.username,
          avatarUrl: data.user.avatar_url || null,
          instanceHost: host,
          instanceName: data.alias || host,
          authType: "pat",
          isCurrent: false,
          tokenStatus: "unknown",
        });
      } else if (token || data) {
        this.tokenStorageService.clearAll("gitlab", host);
      }
    }

    this.accounts = restoredAccounts;
    this.accountsSubject.next(this.getAccounts());

    for (const host of customHosts) {
      this.checkTokenValidity(host).subscribe();
    }
  }
}
