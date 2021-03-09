import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import * as firebase from "firebase/app";
import { auth } from "firebase/app";
import "firebase/auth";
import { Observable } from "rxjs";
import { ToastService } from "./toast.service";

/**
 * A service used to sign in and sign out from Github
 */
@Injectable({
  providedIn: "root",
})
export class AuthService {
  /**
   * AuthService constructor
   * @param {Router} router
   * @param {HttpClient} http
   * @param {ToastService} toastService
   */
  constructor(
    private router: Router,
    private http: HttpClient,
    private toastService: ToastService
  ) {}

  /**
   * The Github access token
   */
  token = null;
  username = null;
  loading = false;

  /**
   * Returns the Github access token, so if its value is null, it's similar to a falsy value
   *
   * @returns The Github access token
   */
  isSignedIn(): string {
    return this.token;
  }

  /**
   * Redirects to Github sign in URL with firebase
   */
  signIn(): Promise<void> {
    const provider = new firebase.auth.GithubAuthProvider();
    provider.addScope("repo");

    return firebase
      .auth()
      .setPersistence(auth.Auth.Persistence.LOCAL)
      .then(() => {
        return firebase.auth().signInWithRedirect(provider);
      })
      .catch((error) => {});
  }

  /**
   * Called when Github redirects to the application after signing in.
   * If authentication is valid, we store the Github access token
   */
  callback(): Promise<void> {
    return new Promise((resolve, reject) => {
      firebase
        .auth()
        .getRedirectResult()
        .then((result) => {
          if (result.credential) {
            this.token = result.credential["accessToken"];
            this.username = result.additionalUserInfo.username;
          }
          result.user ? resolve() : reject();
        })
        .catch((error) => {
          this.toastService.error("An error occured", error.message);
        });
    });
  }

  /**
   * Signs out from Github, sets the access token to null and redirects to home
   */
  signOut() {
    firebase
      .auth()
      .signOut()
      .then(() => {
        this.token = null;
        this.username = null;
        this.router.navigate(["/"]);
      })
      .catch((error) => {
        this.toastService.error("An error occured", error.message);
      });
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
      if (!this.isSignedIn() && user) {
        const provider = new firebase.auth.GithubAuthProvider();
        provider.addScope("repo");
        user.reauthenticateWithRedirect(provider);
      }
    });
  }
}
