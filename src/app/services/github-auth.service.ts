import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable, Optional } from "@angular/core";
import { Router } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import * as firebase from "firebase/app";
import { auth } from "firebase/app";
import "firebase/auth";
import { BehaviorSubject, Observable } from "rxjs";
import { Account, GitProviderType } from "@models/Account.model";
import { GitAuthProvider } from "@models/GitAuthProvider.model";
import { TokenStorageService } from "@services/token-storage.service";
import { ToastService } from "./toast.service";

export interface AuthState {
  isSignedIn: boolean;
  token: string | null;
  username: string | null;
  avatarUrl: string | null;
  displayName: string | null;
}

/**
 * A service used to sign in and sign out from GitHub via Firebase.
 * Implements the GitAuthProvider strategy interface.
 */
@Injectable({
  providedIn: "root",
})
export class GithubAuthService implements GitAuthProvider {
  readonly provider: GitProviderType = "github";
  readonly name: string = "GitHub";
  readonly instanceHost: string = "github.com";

  token: string | null = null;
  username: string | null = null;
  avatarUrl: string | null = null;
  displayName: string | null = null;
  loading = false;

  public authChange$ = new BehaviorSubject<AuthState>({
    isSignedIn: false,
    token: null,
    username: null,
    avatarUrl: null,
    displayName: null,
  });

  constructor(
    private router: Router,
    private http: HttpClient,
    private toastService: ToastService,
    private tokenStorageService: TokenStorageService,
    @Optional() private translateService?: TranslateService,
  ) {
    this.restoreSession();

    firebase.auth().onAuthStateChanged((user) => {
      if (user && this.isSignedIn()) {
        this.syncUserFromFirebase(user);
      }
    });

    if (this.token && (!this.username || !this.avatarUrl)) {
      this.fetchUserProfile();
    }
  }

  isSignedIn(): boolean {
    return !!this.token;
  }

  getAccount(): Account | null {
    if (!this.isSignedIn()) {
      return null;
    }
    const username = this.username || "github_user";
    return {
      id: "acc-github-real",
      provider: "github",
      instanceHost: this.instanceHost,
      username,
      avatarUrl: this.avatarUrl || `https://avatars.githubusercontent.com/${username}`,
      isCurrent: true,
    };
  }

  async signIn(rememberMe = false): Promise<Account> {
    this.loading = true;
    const provider = new firebase.auth.GithubAuthProvider();
    provider.addScope("repo");
    try {
      const persistence = rememberMe ? auth.Auth.Persistence.LOCAL : auth.Auth.Persistence.SESSION;
      await firebase.auth().setPersistence(persistence);
      const result = await firebase.auth().signInWithPopup(provider);
      this.handleAuthResult(result, rememberMe);
      const account = this.getAccount();
      if (!account) {
        throw new Error("GitHub authentication succeeded but account details could not be retrieved");
      }
      return account;
    } catch (error: any) {
      if (error?.code !== "auth/popup-closed-by-user") {
        const title = this.translateService?.instant("ERROR") || "Error";
        this.toastService.error(title, error.message);
      }
      throw error;
    } finally {
      this.loading = false;
    }
  }

  async signOut(): Promise<void> {
    try {
      await firebase.auth().signOut();
    } catch (error: any) {
      console.warn("Firebase signOut error:", error);
    } finally {
      this.token = null;
      this.username = null;
      this.avatarUrl = null;
      this.displayName = null;
      this.tokenStorageService.clearAll("github");
      localStorage.removeItem("dev_github_token");
      localStorage.removeItem("github_username");
      localStorage.removeItem("github_avatar");
      localStorage.removeItem("github_display_name");
      this.notifyAuthChange();
      this.router.navigate(["/"]);
    }
  }

  getProfileUrl(username?: string): string {
    const user = username || this.username;
    if (!user) {
      return `https://${this.instanceHost}`;
    }
    return `https://${this.instanceHost}/${encodeURIComponent(user)}`;
  }

  verifyUserAccess(repoURL: string): Observable<any> {
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: "token " + this.token,
      }),
    };

    const repoHashURL = repoURL.split("/");
    const url = "https://api.github.com/repos/" + repoHashURL[3] + "/" + repoHashURL[4];
    return this.http.get(url, httpOptions);
  }

  async fetchUserProfile(rememberMe?: boolean): Promise<void> {
    if (!this.token) {
      return;
    }
    try {
      const profile: any = await this.http
        .get("https://api.github.com/user", {
          headers: new HttpHeaders({
            Authorization: "token " + this.token,
          }),
        })
        .toPromise();
      const isRemembered = rememberMe !== undefined ? rememberMe : this.tokenStorageService.isRemembered("github");
      this.updateProfile(
        {
          username: profile?.login,
          avatarUrl: profile?.avatar_url,
          displayName: profile?.name || profile?.login,
        },
        isRemembered,
      );
    } catch (e) {
      console.warn("Could not fetch GitHub profile via API:", e);
    }
  }

  private restoreSession(): void {
    const storedToken = this.tokenStorageService.getToken("github");
    const storedUser = this.tokenStorageService.getUserData<{
      username?: string;
      avatarUrl?: string;
      displayName?: string;
    }>("github");

    if (storedToken) {
      this.token = storedToken;
      this.username = storedUser?.username || null;
      this.avatarUrl = storedUser?.avatarUrl || null;
      this.displayName = storedUser?.displayName || null;
    } else {
      this.token = null;
      this.username = null;
      this.avatarUrl = null;
      this.displayName = null;
    }

    this.notifyAuthChange();
  }

  private updateProfile(
    data: { username?: string | null; avatarUrl?: string | null; displayName?: string | null },
    rememberMe = false,
  ): void {
    this.username = data.username ?? this.username;
    this.avatarUrl = data.avatarUrl ?? this.avatarUrl;
    this.displayName = data.displayName ?? this.displayName;

    this.tokenStorageService.saveUserData(
      "github",
      {
        username: this.username,
        avatarUrl: this.avatarUrl,
        displayName: this.displayName,
      },
      rememberMe,
    );

    this.notifyAuthChange();
  }

  private syncUserFromFirebase(user: any): void {
    const screenName = user?.reloadUserInfo?.screenName || user?.displayName;
    const isRemembered = this.tokenStorageService.isRemembered("github");
    this.updateProfile(
      {
        username: this.username || screenName,
        avatarUrl: this.avatarUrl || user?.photoURL,
        displayName: this.displayName || user?.displayName,
      },
      isRemembered,
    );
  }

  private handleAuthResult(result: any, rememberMe = false): void {
    this.token = result?.credential?.accessToken ?? this.token;
    if (this.token) {
      this.tokenStorageService.saveToken("github", this.token, rememberMe);
    }
    this.updateProfile(
      {
        username: result?.additionalUserInfo?.username,
        avatarUrl: result?.user?.photoURL,
        displayName: result?.user?.displayName,
      },
      rememberMe,
    );
    if (this.token && (!this.username || !this.avatarUrl)) {
      this.fetchUserProfile(rememberMe);
    }
  }

  private notifyAuthChange(): void {
    this.authChange$.next({
      isSignedIn: !!this.token,
      token: this.token,
      username: this.username,
      avatarUrl: this.avatarUrl,
      displayName: this.displayName,
    });
  }
}
