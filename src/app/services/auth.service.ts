import { Injectable } from '@angular/core';
import * as firebase from 'firebase/app';
import 'firebase/auth';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(private router: Router) {}

  token = null;

  isSignedIn(caller) {
    return this.token;
  }

  signIn() {
    return new Promise((resolve, reject) => {
      const provider = new firebase.auth.GithubAuthProvider();
      provider.addScope('repo');

      firebase.auth().signInWithRedirect(provider);
      resolve(true);
    });
  }

  callback() {
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
