import { Component, OnInit } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import moment from 'moment/src/moment';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent implements OnInit {
  constructor(
    public authService: AuthService,
    private router: Router,
    private spinner: NgxSpinnerService
  ) {}

  loading = false;
  json = {
    date: '01/01/17 12:00',
    repositories: [
      { url: 'https://czczevzev.com', name: 'Mika PONS', groupeTP: '12' }
    ],
    seances: [
      {
        dateDebut: '22/05/19 10:00',
        dateFin: '22/05/19 11:00',
        groupeTP: '11'
      }
    ],
    reviews: [{ date: '07/03/19 15:40', label: 'Review 1', groupeTP: '21' }],
    corrections: [
      { date: '07/03/19 15:40', label: 'Correction 1', groupeTP: '22' }
    ]
  };

  ngOnInit() {
    console.log('NGONINIT');

    if (!this.authService.isSignedIn('ngOnInit')) {
      this.spinner.show();
      this.loading = true;

      this.authService.callback().then(
        () => {
          this.spinner.hide();
          this.loading = false;
          this.router.navigate(['graph']);
        },
        () => {
          this.loading = false;
        }
      );
    }
  }

  onSignIn() {
    this.authService.signIn().then(() => {});
  }

  onSignInGithub() {
    this.authService.signIn();
  }

  onSignOut() {
    this.authService.signOut();
  }
}
