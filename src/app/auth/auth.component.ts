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


  public fileString;
  public filename;

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


  changeListener($event): void {
    this.readThis($event.target);
  }

  readThis(inputValue: any): void {
      const file: File = inputValue.files[0];
      const myReader: FileReader = new FileReader();
      const fileType = inputValue.parentElement.id;
      myReader.onloadend = (e) => {
        // console.log(myReader.result);
        // this.fileString = myReader.result;
        // console.log(JSON.parse(this.fileString).salut.bonjour);
        this.filename = file.name;
        console.log('salut ' + this.IsValidJSONString(myReader.result));
     };

      myReader.readAsText(file);
  }

  IsValidJSONString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
  }

}
