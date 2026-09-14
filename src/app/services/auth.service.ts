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
  token: string | null = localStorage.getItem("dev_github_token") || null;
  username: string | null = localStorage.getItem("github_username") || null;
  avatarUrl: string | null = localStorage.getItem("github_avatar") || null;
  displayName: string | null = localStorage.getItem("github_display_name") || null;
  loading = false;

  public authChange$ = new BehaviorSubject<AuthState>({
    isSignedIn: !!localStorage.getItem("dev_github_token"),
    token: localStorage.getItem("dev_github_token") || null,
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
  constructor(private router: Router, private http: HttpClient, private toastService: ToastService) {
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
    let url = "https://api.github.com/repos/" + repoHashURL[3] + "/" + repoHashURL[4];
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
      this.updateProfile({
        username: profile?.login,
        avatarUrl: profile?.avatar_url,
        displayName: profile?.name || profile?.login,
      });
    } catch (e) {
      console.warn("Could not fetch GitHub profile via API:", e);
    }
  }

  private updateProfile(data: { username?: string | null; avatarUrl?: string | null; displayName?: string | null }): void {
    this.username = data.username ?? this.username;
    this.avatarUrl = data.avatarUrl ?? this.avatarUrl;
    this.displayName = data.displayName ?? this.displayName;

    const cacheItems: [string, string | null][] = [
      ["github_username", this.username],
      ["github_avatar", this.avatarUrl],
      ["github_display_name", this.displayName],
    ];
    for (const [key, value] of cacheItems) {
      if (value) {
        localStorage.setItem(key, value);
      }
    }
    this.notifyAuthChange();
  }

  private syncUserFromFirebase(user: any): void {
    const screenName = user?.reloadUserInfo?.screenName || user?.displayName;
    this.updateProfile({
      username: this.username || screenName,
      avatarUrl: this.avatarUrl || user?.photoURL,
      displayName: this.displayName || user?.displayName,
    });
  }

  private handleAuthResult(result: any): void {
    this.token = result?.credential?.accessToken ?? this.token;
    this.updateProfile({
      username: result?.additionalUserInfo?.username,
      avatarUrl: result?.user?.photoURL,
      displayName: result?.user?.displayName,
    });
    if (this.token && (!this.username || !this.avatarUrl)) {
      this.fetchUserProfile();
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
