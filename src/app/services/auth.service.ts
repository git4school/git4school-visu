import { Injectable } from '@angular/core';
import * as firebase from 'firebase/app';
import 'firebase/auth';
import { Router } from '@angular/router';
import { promise } from 'protractor';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(private router: Router) {}

  token = 'bfd58d4a3f0931b926ecad3d38e551c5705a6844';

  isSignedIn(caller) {
    // console.log('isSignedIn : ' + this.isSignedIn.caller);
    // console.log('isSignedIn : ', caller);

    // const user = firebase.auth().currentUser;
    // if (user) {
    //   return true;
    // } else {
    //   return false;
    // }
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
      // if (this.isSignedIn()) {
      //   reject();
      // }
      console.log('callback');
      firebase
        .auth()
        .getRedirectResult()
        .then(result => {
          console.log('getredirect');
          if (result.credential) {
            // tslint:disable-next-line: no-string-literal
            console.log('result ', result.credential['accessToken']);
            // tslint:disable-next-line: no-string-literal
            this.token = result.credential['accessToken'];
          }
          const user = result.user;
          if (!user) {
            reject();
          } else {
            resolve();
          }
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
