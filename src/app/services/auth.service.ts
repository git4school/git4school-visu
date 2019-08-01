import { Injectable } from '@angular/core';
import * as firebase from 'firebase/app';
import 'firebase/auth';
import { Router } from '@angular/router';

/**
 * A service used to sign in and sign out from Github
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  /**
   * AuthService constructor
   * @param router
   */
  constructor(private router: Router) {}

  /**
   * The Github access token
   */
  token = null;

  /**
   * Returns the Github access token, so if its value is null, it's similar to a falsy value
   *
   * @returns The Github access token
   */
  isSignedIn(caller): string {
    return this.token;
  }

  /**
   * Redirects to Github sign in URL with firebase
   */
  signIn(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const provider = new firebase.auth.GithubAuthProvider();
      provider.addScope('repo');

      firebase.auth().signInWithRedirect(provider);
      resolve(true);
    });
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
        .then(result => {
          if (result.credential) {
            this.token = result.credential['accessToken'];
          }
          result.user ? resolve() : reject();
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
        window.location.href = '/';
      });
  }
}
