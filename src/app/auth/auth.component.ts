import { Component, OnInit } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import moment from 'moment/src/moment';
import { ClipboardService } from 'ngx-clipboard';
import { NgForm } from '@angular/forms';
declare var $: any;

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent implements OnInit {
  constructor(
    public authService: AuthService,
    private router: Router,
    private spinner: NgxSpinnerService,
    private clipboardService: ClipboardService
  ) {}

  loading = false;

  ngOnInit() {
    $('#copier').tooltip();

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

  callServiceToCopy() {
    this.clipboardService.copyFromContent(`
{
  "startDate": "01/01/17 12:00",
  "dateFin": "01/04/18 12:00",
  "repositories": [
    { "url": "https://github.com/user/repository", "name": "First name LAST NAME", "groupeTP": "12" }
  ],
  "seances": [
    {
      "startDate": "22/05/19 10:00",
      "dateFin": "22/05/19 11:00",
      "groupeTP": "11"
    }
  ],
  "reviews": [
    { "date": "07/03/19 15:40", "label": "Review 1", "groupeTP": "21" }
  ],
  "corrections": [
    { "date": "07/03/19 15:40", "label": "Correction 1", "groupeTP": "22" }
  ]
}`);
  }
}
