import { Component, OnInit } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import moment from 'moment/src/moment';
import { ClipboardService } from 'ngx-clipboard';
import { NgForm } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
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
    private clipboardService: ClipboardService,
    private http: HttpClient
  ) {}

  loading = false;
  changelog;
  readMe = `# First IT practical

### NOM : DOE
### Prénom : John
### Groupe de TP : 
- [ ] 11
- [x] 12
- [ ] 21
- [ ] 22`;

  ngOnInit() {
    this.getChangelog();
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

  getChangelog() {
    this.http
      .get(
        'https://api.github.com/repos/F0urchette/test-angular/contents/CHANGELOG.md'
      )
      .subscribe(data => {
        this.changelog = decodeURIComponent(escape(window.atob(data.content)));
      });
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

  copyJSON() {
    this.clipboardService.copyFromContent(`
{
  "startDate": "2017-01-22 12:00",
  "endDate": "2018-04-23 12:00",
  "repositories": [
    { "url": "https://github.com/user/repository", "name": "First name LAST NAME", "tpGroup": "12" }
  ],
  "sessions": [
    {
      "startDate": "2019-05-22 10:00",
      "endDate": "2019-05-22 11:00", 
      "tpGroup": "11"
    }
  ],
  "reviews": [
    { "date": "2019-03-15 15:40", "label": "Review 1", "tpGroup": "21", "questions": ["1.1", "1.2"] }
  ],
  "corrections": [
    { "date": "2019-03-17 15:40", "label": "Correction 1", "tpGroup": "22", "questions": ["1.1", "1.2"] }
  ],
  "others": [
    {"date": "2019-03-19 15:40", "label": "Other 1", "tpGroup": "12", "questions": [] }
  ]
}`);
  }

  copyReadMe() {
    this.clipboardService.copyFromContent(this.readMe);
  }
}
