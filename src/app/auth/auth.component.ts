import { Component, OnInit } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import * as firebase from 'firebase/app';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent implements OnInit {

  constructor(public authService: AuthService, private router: Router, private spinner: NgxSpinnerService) { }

  token = this.authService.token;
  loading = false;

  ngOnInit() {
    console.log('NGONINIT');

    if (!this.authService.isSignedIn('ngOnInit')) {
      this.spinner.show();
      this.loading = true;

      this.authService.callback().then(
        () => {
          this.spinner.hide();
          this.loading = false;
          this.router.navigate(['appareils']);
        }
      );
    }
  }

  onSignIn() {
    this.authService.signIn().then(
      () => {
        this.token = this.authService.token;
      }
    );
  }

  onSignInGithub() {
    this.authService.signIn();
    this.token = this.authService.token;
  }

  onSignOut() {
    this.authService.signOut();
    this.token = null;
  }

}
