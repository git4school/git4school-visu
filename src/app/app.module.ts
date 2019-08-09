import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { ChartsModule } from 'ng2-charts';
import { NgxSpinnerModule } from 'ngx-spinner';
import * as firebase from 'firebase/app';
import 'firebase/performance';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ToastrModule } from 'ngx-toastr';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ClipboardModule } from 'ngx-clipboard';
import { MarkdownModule } from 'ngx-markdown';
import { TypeaheadModule } from 'ngx-type-ahead';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { CommitsService } from '@services/commits.service';
import { AuthService } from '@services/auth.service';
import { JsonManagerService } from '@services/json-manager.service';
import { DataService } from '@services/data.service';
import { HomeComponent } from '@components/home/home.component';
import { StudentsCommitsComponent } from '@components/graphs/students-commits/students-commits.component';
import { QuestionsCompletionComponent } from '@components/graphs/questions-completion/questions-completion.component';
import { MetadataComponent } from '@components/metadata/metadata.component';
import { OverviewComponent } from '@components/graphs/overview/overview.component';
import { FourOhFourComponent } from '@components/four-oh-four/four-oh-four.component';
import { DataProvidedGuard } from '@guards/data-provided.guard';
import { DataLoadingGuard } from '@guards/data-loading.guard';
import { AuthGuard } from '@guards/auth.guard';

/**
 * Firebase configuration file
 */
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

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    FourOhFourComponent,
    OverviewComponent,
    StudentsCommitsComponent,
    QuestionsCompletionComponent,
    MetadataComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
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

/**
 * Loader factory for translation service, using HTTP
 * @param httpClient
 */
export function HttpLoaderFactory(httpClient: HttpClient) {
  return new TranslateHttpLoader(httpClient);
}
