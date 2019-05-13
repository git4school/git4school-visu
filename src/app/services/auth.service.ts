import { Injectable } from '@angular/core';
import * as firebase from 'firebase/app';
import 'firebase/auth';
import { Router } from '@angular/router';
import { promise } from 'protractor';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(private router: Router) {
    firebase.initializeApp(this.firebaseConfig);
  }

  firebaseConfig = {
    apiKey: 'AIzaSyB8DNpcDkp2bhVFJ9KOdVnWwTn1vsSrkpo',
    authDomain: 'test-angular-2af6b.firebaseapp.com',
    databaseURL: 'https://test-angular-2af6b.firebaseio.com',
    projectId: 'test-angular-2af6b',
    storageBucket: 'test-angular-2af6b.appspot.com',
    messagingSenderId: '98521239187',
    appId: '1:98521239187:web:bfac7cc7cf869e62'
  };

  token = null;

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
    return new Promise(
      (resolve, reject) => {
        const provider = new firebase.auth.GithubAuthProvider();
        provider.addScope('repo');

        firebase.auth().signInWithRedirect(provider);
        resolve(true);
      }
    );
  }

  callback() {
    return new Promise((resolve, reject) => {
      // if (this.isSignedIn()) {
      //   reject();
      // }
      firebase.auth().getRedirectResult().then((result) => {
        if (result.credential) {
  // tslint:disable-next-line: no-string-literal
          this.token = result.credential['accessToken'];
        }
        const user = result.user;
        resolve();
      });
    });
  }

  signOut() {
    firebase.auth().signOut();
    this.token = null;
  }
}
