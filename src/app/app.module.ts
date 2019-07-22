import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AuthComponent } from './auth/auth.component';
import { Routes, RouterModule } from '@angular/router';
import { AuthService } from './services/auth.service';
import { FourOhFourComponent } from './four-oh-four/four-oh-four.component';
import { AuthGuard } from './services/auth-guard.service';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { GraphViewComponent } from './graph-view/graph-view.component';
import { ChartsModule } from 'ng2-charts';
import { NgxSpinnerModule } from 'ngx-spinner';
import { CommitsService } from './services/commits.service';
import * as firebase from 'firebase/app';
import 'firebase/performance';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ToastrModule } from 'ngx-toastr';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ClipboardModule } from 'ngx-clipboard';
import { MarkdownModule } from 'ngx-markdown';
import { TypeaheadModule } from 'ngx-type-ahead';
import { JsonManagerService } from './services/json-manager.service';
import { DataService } from './services/data.service';
import { StudentsCommitsViewComponent } from './students-commits-view/students-commits-view.component';
import { QuestionsCompletionViewComponent } from './questions-completion-view/questions-completion-view.component';
import { MetadataViewComponent } from './metadata-view/metadata-view.component';
import { DataProvidedGuard } from './services/data-provided.guard';
import { DataLoadingGuard } from './services/data-loading.guard';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

const firebaseConfig = {
  apiKey: 'AIzaSyA3kJGK7-b7YbLnb0RBc38kTfqkc_fT0xY',
  authDomain: 'git4school.firebaseapp.com',
  databaseURL: 'https://git4school.firebaseio.com',
  projectId: 'git4school',
  storageBucket: '',
  messagingSenderId: '896582512902',
  appId: '1:896582512902:web:db9dc0ffe2590b10'
};

firebase.initializeApp(firebaseConfig);

const appRoutes: Routes = [
  { path: 'auth', component: AuthComponent },
  { path: '', component: AuthComponent },
  { path: 'not-found', component: FourOhFourComponent },
  {
    path: 'graph',
    canActivate: [AuthGuard],
    canDeactivate: [DataLoadingGuard],
    component: GraphViewComponent
  },
  {
    path: 'students-commits-view',
    canActivate: [AuthGuard, DataProvidedGuard],
    component: StudentsCommitsViewComponent
  },
  {
    path: 'questions-completion-view',
    canActivate: [AuthGuard, DataProvidedGuard],
    component: QuestionsCompletionViewComponent
  },
  {
    path: 'edit-metadata',
    canActivate: [AuthGuard, DataProvidedGuard],
    component: MetadataViewComponent
  },
  { path: '**', redirectTo: 'not-found' }
];

@NgModule({
  declarations: [
    AppComponent,
    AuthComponent,
    FourOhFourComponent,
    GraphViewComponent,
    StudentsCommitsViewComponent,
    QuestionsCompletionViewComponent,
    MetadataViewComponent
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
    ClipboardModule,
    MarkdownModule.forRoot(),
    TypeaheadModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient]
      }
    }),
    NgbModule
  ],
  providers: [
    AuthService,
    AuthGuard,
    CommitsService,
    JsonManagerService,
    DataService
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor() {}
}

export function HttpLoaderFactory(httpClient: HttpClient) {
  return new TranslateHttpLoader(httpClient);
}
