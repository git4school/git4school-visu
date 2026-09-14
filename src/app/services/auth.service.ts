import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import * as firebase from "firebase/app";
import { auth } from "firebase/app";
import "firebase/auth";
import { BehaviorSubject, Observable } from "rxjs";
import { ToastService } from "./toast.service";

export interface AuthState {
  isSignedIn: boolean;
  token: string | null;
  username: string | null;
  avatarUrl: string | null;
  displayName: string | null;
}

/**
 * A service used to sign in and sign out from Github
 */
@Injectable({
  providedIn: "root",
})
export class AuthService {
  /**
   * The Github access token
   */
  token: string | null =
    localStorage.getItem("github_token") ||
    localStorage.getItem("dev_github_token") ||
    null;
  username: string | null = localStorage.getItem("github_username") || null;
  avatarUrl: string | null = localStorage.getItem("github_avatar") || null;
  displayName: string | null =
    localStorage.getItem("github_display_name") || null;
  loading = false;

  public authChange$ = new BehaviorSubject<AuthState>({
    isSignedIn: !!(
      localStorage.getItem("github_token") ||
      localStorage.getItem("dev_github_token")
    ),
    token:
      localStorage.getItem("github_token") ||
      localStorage.getItem("dev_github_token") ||
      null,
    username: localStorage.getItem("github_username") || null,
    avatarUrl: localStorage.getItem("github_avatar") || null,
    displayName: localStorage.getItem("github_display_name") || null,
  });

  /**
   * AuthService constructor
   * @param router
   * @param http
   * @param toastService
   */
  constructor(
    private router: Router,
    private http: HttpClient,
    private toastService: ToastService
  ) {
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        this.syncUserFromFirebase(user);
      }
    });

    if (this.token && (!this.username || !this.avatarUrl)) {
      this.fetchUserProfile();
    }
  }

  /**
   * Returns the Github access token, so if its value is null, it's similar to a falsy value
   *
   * @returns The Github access token
   */
  isSignedIn(): string {
    return this.token;
  }

  /**
   * Open a popup to Github signin with firebase and authenticate
   */
  async signIn(): Promise<void> {
    this.loading = true;
    const provider = new firebase.auth.GithubAuthProvider();
    provider.addScope("repo");
    try {
      await firebase.auth().setPersistence(auth.Auth.Persistence.LOCAL);
      const result = await firebase.auth().signInWithPopup(provider);
      this.handleAuthResult(result);
    } catch (error: any) {
      if (error?.code !== "auth/popup-closed-by-user") {
        this.toastService.error("An error occured", error.message);
      }
      throw error;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Signs out from Github, sets the access token to null and redirects to home
   */
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
      localStorage.removeItem("github_token");
      localStorage.removeItem("github_username");
      localStorage.removeItem("github_avatar");
      localStorage.removeItem("github_display_name");
      this.notifyAuthChange();
      this.router.navigate(["/"]);
    }
  }

  verifyUserAccess(repoURL: string): Observable<any> {
    var httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: "token " + this.token,
      }),
    };

    const repoHashURL = repoURL.split("/");
    let url =
      "https://api.github.com/repos/" + repoHashURL[3] + "/" + repoHashURL[4];
    return this.http.get(url, httpOptions);
  }

  reauthenticate() {
    firebase.auth().onAuthStateChanged((user) => {
      if (user && !this.isSignedIn()) {
        this.loading = true;
        const provider = new firebase.auth.GithubAuthProvider();
        provider.addScope("repo");
        user
          .reauthenticateWithPopup(provider)
          .then((result) => this.handleAuthResult(result))
          .catch((err) => console.warn("Reauth error:", err))
          .finally(() => {
            this.loading = false;
          });
      } else if (user && this.isSignedIn()) {
        this.syncUserFromFirebase(user);
      }
    });
  }

  async fetchUserProfile(): Promise<void> {
    if (!this.token) return;
    try {
      const profile: any = await this.http
        .get("https://api.github.com/user", {
          headers: new HttpHeaders({
            Authorization: "token " + this.token,
          }),
        })
        .toPromise();
      if (profile) {
        this.username = profile.login || this.username;
        this.avatarUrl = profile.avatar_url || this.avatarUrl;
        this.displayName = profile.name || profile.login || this.displayName;
        if (this.username) {
          localStorage.setItem("github_username", this.username);
        }
        if (this.avatarUrl) {
          localStorage.setItem("github_avatar", this.avatarUrl);
        }
        if (this.displayName) {
          localStorage.setItem("github_display_name", this.displayName);
        }
        this.notifyAuthChange();
      }
    } catch (e) {
      console.warn("Could not fetch GitHub profile via API:", e);
    }
  }

  private syncUserFromFirebase(user: any) {
    if (!this.username) {
      this.username =
        user.reloadUserInfo?.screenName ||
        user.displayName ||
        localStorage.getItem("github_username") ||
        null;
    }
    if (!this.avatarUrl && user.photoURL) {
      this.avatarUrl = user.photoURL;
    }
    if (!this.displayName && user.displayName) {
      this.displayName = user.displayName;
    }
    this.notifyAuthChange();
  }

  private handleAuthResult(result: any) {
    if (result?.credential) {
      this.token = result.credential["accessToken"];
      if (this.token) {
        localStorage.setItem("github_token", this.token);
      }
    }
    if (result?.additionalUserInfo?.username) {
      this.username = result.additionalUserInfo.username;
      localStorage.setItem("github_username", this.username);
    }
    if (result?.user?.photoURL) {
      this.avatarUrl = result.user.photoURL;
      localStorage.setItem("github_avatar", this.avatarUrl);
    }
    if (result?.user?.displayName) {
      this.displayName = result.user.displayName;
      localStorage.setItem("github_display_name", this.displayName);
    }
    this.notifyAuthChange();

    if (this.token && (!this.username || !this.avatarUrl)) {
      this.fetchUserProfile();
    }
  }

  private notifyAuthChange() {
    this.authChange$.next({
      isSignedIn: !!this.token,
      token: this.token,
      username: this.username,
      avatarUrl: this.avatarUrl,
      displayName: this.displayName,
    });
  }
}
