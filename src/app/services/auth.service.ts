import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import * as firebase from "firebase/app";
import { auth } from "firebase/app";
import "firebase/auth";
import { Observable } from "rxjs";
import { ToastService } from "./toast.service";
import { passBoolean } from "protractor/built/util";

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
  ) {

  }

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
   * Open a popup to Github signin with firebase and authenticate
   */
  async signIn(): Promise<void> {
    this.loading = true;
    const provider = new firebase.auth.GithubAuthProvider();
    provider.addScope("repo");
    try {
      await firebase.auth().setPersistence(auth.Auth.Persistence.LOCAL);
      firebase
        .auth()
        .signInWithPopup(provider)
        .then((result) => {
          this.token = result.credential["accessToken"];
          this.username = result.additionalUserInfo.username;
        })
        .finally(() => {
          this.loading = false;
        });
    } catch (error) {
      this.toastService.error("An error occured", error.message);
    }
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
      if (user && !this.isSignedIn()) {
        this.loading = true;
        const provider = new firebase.auth.GithubAuthProvider();
        provider.addScope("repo");
        user
          .reauthenticateWithPopup(provider)
          .then((result) => {
            this.token = result.credential["accessToken"];
            this.username = result.additionalUserInfo.username;
          })
          .finally(() => {
            this.loading = false;
          });
      }
    });
  }
}
