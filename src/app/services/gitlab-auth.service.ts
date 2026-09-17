import { HttpClient, HttpHeaders, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { Account, GitProviderType } from "@models/Account.model";
import { GitAuthProvider } from "@models/GitAuthProvider.model";
import { environment } from "../../environments/environment";

export interface GitlabUser {
  id: number;
  username: string;
  name: string;
  avatar_url: string;
  web_url: string;
}

export interface GitlabAuthState {
  isSignedIn: boolean;
  token: string | null;
  user: GitlabUser | null;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  scope?: string;
  created_at?: number;
}

@Injectable({
  providedIn: "root",
})
export class GitlabAuthService implements GitAuthProvider {
  readonly provider: GitProviderType = "gitlab";
  readonly name: string = "GitLab";
  readonly instanceHost: string =
    (environment.gitlab?.instanceUrl || "https://gitlab.com").replace(/^https?:\/\//i, "").replace(/\/.*$/, "") || "gitlab.com";

  token: string | null = null;
  currentUser: GitlabUser | null = null;
  loading = false;

  public authChange$ = new BehaviorSubject<GitlabAuthState>({
    isSignedIn: false,
    token: null,
    user: null,
  });

  private clientId = environment.gitlab?.clientId || "";
  private redirectUri = environment.gitlab?.redirectUri || "/auth/callback";
  private instanceUrl = (environment.gitlab?.instanceUrl || "https://gitlab.com").replace(/\/+$/, "");
  private scope = environment.gitlab?.scope || "read_api read_user";

  constructor(private http: HttpClient) {}

  isSignedIn(): boolean {
    return !!(this.token && this.currentUser);
  }

  getAccount(): Account | null {
    if (!this.isSignedIn() || !this.currentUser) {
      return null;
    }
    return {
      id: "acc-gitlab-cloud",
      provider: "gitlab",
      instanceHost: this.instanceHost,
      username: this.currentUser.username,
      avatarUrl: this.currentUser.avatar_url || null,
      isCurrent: false,
    };
  }

  async signIn(): Promise<Account> {
    await this.loginWithPopup();
    const account = this.getAccount();
    if (!account) {
      throw new Error("GitLab authentication succeeded but account details could not be retrieved");
    }
    return account;
  }

  async loginWithPopup(): Promise<GitlabUser> {
    if (!this.clientId) {
      throw new Error("GitLab Client ID is not configured in environment.ts");
    }

    this.loading = true;

    try {
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = await this.generateCodeChallenge(codeVerifier);
      const state = this.generateRandomString(32);

      sessionStorage.setItem("gitlab_oauth_verifier", codeVerifier);
      sessionStorage.setItem("gitlab_oauth_state", state);

      const params = new URLSearchParams({
        client_id: this.clientId,
        redirect_uri: this.effectiveRedirectUri,
        response_type: "code",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        scope: this.scope,
      });

      const authUrl = `${this.instanceUrl}/oauth/authorize?${params.toString()}`;
      const code = await this.openAuthPopup(authUrl, state);

      const tokenResponse = await this.exchangeCodeForToken(code, codeVerifier);
      const accessToken = tokenResponse.access_token;

      let user: GitlabUser;
      try {
        user = await this.fetchUserProfile(accessToken);
      } catch (err: any) {
        if (err?.status === 401 || err?.statusCode === 401) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          user = await this.fetchUserProfile(accessToken);
        } else {
          throw err;
        }
      }

      this.token = accessToken;
      this.currentUser = user;

      this.notifyAuthChange();
      return user;
    } finally {
      this.loading = false;
      sessionStorage.removeItem("gitlab_oauth_verifier");
      sessionStorage.removeItem("gitlab_oauth_state");
    }
  }

  signOut(): void {
    this.token = null;
    this.currentUser = null;
    this.notifyAuthChange();
  }

  getProfileUrl(username?: string): string {
    const user = username || this.currentUser?.username;
    if (!user) {
      return `https://${this.instanceHost}`;
    }
    return `https://${this.instanceHost}/${encodeURIComponent(user)}`;
  }

  private get effectiveRedirectUri(): string {
    if (this.redirectUri.startsWith("/")) {
      const base = typeof document !== "undefined" && document.baseURI ? document.baseURI : window.location.origin;
      return new URL(this.redirectUri.replace(/^\//, ""), base).href;
    }
    return this.redirectUri;
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(64);
    window.crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }

  private generateRandomString(length: number): string {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return this.base64UrlEncode(array).slice(0, length);
  }

  private base64UrlEncode(buffer: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < buffer.byteLength; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  private openAuthPopup(url: string, expectedState: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      localStorage.removeItem("gitlab_oauth_callback_data");

      const popup = window.open(
        url,
        "gitlab_oauth_popup",
        `width=${width},height=${height},top=${top},left=${left},status=no,toolbar=no,menubar=no`,
      );

      if (!popup) {
        reject(new Error("Popup blocked by browser"));
        return;
      }

      let isResolved = false;

      const handlePayload = (data: any) => {
        if (!data || data.type !== "GITLAB_OAUTH_CALLBACK" || isResolved) {
          return;
        }

        cleanup();

        if (data.error) {
          reject(new Error(data.errorDescription || data.error));
          return;
        }

        if (data.state !== expectedState) {
          reject(new Error("Invalid OAuth state parameter"));
          return;
        }

        if (!data.code) {
          reject(new Error("No authorization code received"));
          return;
        }

        isResolved = true;
        resolve(data.code);
      };

      const messageListener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) {
          return;
        }
        handlePayload(event.data);
      };

      const storageListener = (event: StorageEvent) => {
        if (event.key === "gitlab_oauth_callback_data" && event.newValue) {
          try {
            const data = JSON.parse(event.newValue);
            handlePayload(data);
          } catch (e) {
            console.warn("Invalid oauth callback storage event:", e);
          }
        }
      };

      window.addEventListener("message", messageListener);
      window.addEventListener("storage", storageListener);

      const checkClosedInterval = window.setInterval(() => {
        const stored = localStorage.getItem("gitlab_oauth_callback_data");
        if (stored) {
          try {
            const data = JSON.parse(stored);
            handlePayload(data);
            return;
          } catch (e) {
            // ignore
          }
        }

        if (popup.closed) {
          cleanup();
          if (!isResolved) {
            reject(new Error("POPUP_CLOSED"));
          }
        }
      }, 400);

      const cleanup = () => {
        window.removeEventListener("message", messageListener);
        window.removeEventListener("storage", storageListener);
        window.clearInterval(checkClosedInterval);
        localStorage.removeItem("gitlab_oauth_callback_data");
      };
    });
  }

  private exchangeCodeForToken(code: string, verifier: string): Promise<TokenResponse> {
    const tokenUrl = `${this.instanceUrl}/oauth/token`;
    const body = new HttpParams()
      .set("client_id", this.clientId)
      .set("grant_type", "authorization_code")
      .set("redirect_uri", this.effectiveRedirectUri)
      .set("code", code)
      .set("code_verifier", verifier);

    const headers = new HttpHeaders({
      "Content-Type": "application/x-www-form-urlencoded",
    });

    return this.http.post<TokenResponse>(tokenUrl, body.toString(), { headers }).toPromise();
  }

  private fetchUserProfile(token: string): Promise<GitlabUser> {
    const userUrl = `${this.instanceUrl}/api/v4/user`;
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.http.get<GitlabUser>(userUrl, { headers }).toPromise();
  }

  private notifyAuthChange(): void {
    this.authChange$.next({
      isSignedIn: this.isSignedIn(),
      token: this.token,
      user: this.currentUser,
    });
  }
}
