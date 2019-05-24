import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MonPremierComponent } from './mon-premier/mon-premier.component';
import { AppareilComponent } from './appareil/appareil.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AppareilService } from './services/appareil.service';
import { AuthComponent } from './auth/auth.component';
import { AppareilViewComponent } from './appareil-view/appareil-view.component';
import { Routes, RouterModule } from '@angular/router';
import { AuthService } from './services/auth.service';
import { SingleAppareilComponent } from './single-appareil/single-appareil.component';
import { FourOhFourComponent } from './four-oh-four/four-oh-four.component';
import { AuthGuard } from './services/auth-guard.service';
import { EditAppareilComponent } from './edit-appareil/edit-appareil.component';
import { UserService } from './services/user.service';
import { UserListComponent } from './user-list/user-list.component';
import { NewUserComponent } from './new-user/new-user.component';
import { HttpClientModule } from '@angular/common/http';
import { GraphViewComponent } from './graph-view/graph-view.component';
import { ChartsModule } from 'ng2-charts';
import { NgxSpinnerModule } from 'ngx-spinner';
import { CommitViewComponent } from './commit-view/commit-view.component';
import { CommitListComponent } from './commit-list/commit-list.component';
import { CommitsService } from './services/commits.service';
import * as firebase from 'firebase/app';
import 'firebase/performance';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ToastrModule } from 'ngx-toastr';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ClipboardModule } from 'ngx-clipboard';

const firebaseConfig = {
  apiKey: 'AIzaSyB8DNpcDkp2bhVFJ9KOdVnWwTn1vsSrkpo',
  authDomain: 'test-angular-2af6b.firebaseapp.com',
  databaseURL: 'https://test-angular-2af6b.firebaseio.com',
  projectId: 'test-angular-2af6b',
  storageBucket: 'test-angular-2af6b.appspot.com',
  messagingSenderId: '98521239187',
  appId: '1:98521239187:web:bfac7cc7cf869e62'
};

firebase.initializeApp(firebaseConfig);

const appRoutes: Routes = [
  {
    path: 'appareils',
    canActivate: [AuthGuard],
    component: AppareilViewComponent
  },
  {
    path: 'appareils/:id',
    canActivate: [AuthGuard],
    component: SingleAppareilComponent
  },
  { path: 'edit', canActivate: [AuthGuard], component: EditAppareilComponent },
  { path: 'auth', component: AuthComponent },
  { path: '', component: AuthComponent },
  { path: 'not-found', component: FourOhFourComponent },
  { path: 'users', component: UserListComponent },
  { path: 'new-user', canActivate: [AuthGuard], component: NewUserComponent },
  { path: 'graph', canActivate: [AuthGuard], component: GraphViewComponent },
  { path: 'commits', canActivate: [AuthGuard], component: CommitListComponent },
  { path: '**', redirectTo: 'not-found' }
];

@NgModule({
  declarations: [
    AppComponent,
    MonPremierComponent,
    AppareilComponent,
    AuthComponent,
    AppareilViewComponent,
    SingleAppareilComponent,
    FourOhFourComponent,
    EditAppareilComponent,
    UserListComponent,
    NewUserComponent,
    GraphViewComponent,
    CommitViewComponent,
    CommitListComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    RouterModule.forRoot(appRoutes),
    ChartsModule,
    NgxSpinnerModule,
    FontAwesomeModule,
    ToastrModule.forRoot(),
    BrowserAnimationsModule,
    ClipboardModule
  ],
  providers: [
    AppareilService,
    AuthService,
    AuthGuard,
    CommitsService,
    UserService
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
  // firebaseConfig = {
  //   apiKey: 'AIzaSyB8DNpcDkp2bhVFJ9KOdVnWwTn1vsSrkpo',
  //   authDomain: 'test-angular-2af6b.firebaseapp.com',
  //   databaseURL: 'https://test-angular-2af6b.firebaseio.com',
  //   projectId: 'test-angular-2af6b',
  //   storageBucket: 'test-angular-2af6b.appspot.com',
  //   messagingSenderId: '98521239187',
  //   appId: '1:98521239187:web:bfac7cc7cf869e62'
  // };

  constructor() {
    // firebase.initializeApp(this.firebaseConfig);
  }
}
