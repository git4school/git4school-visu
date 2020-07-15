import { LOCATION_INITIALIZED } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { APP_INITIALIZER, Injector, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ConfigurationComponent } from '@components/configuration/configuration.component';
import { EditRepositoriesComponent } from '@components/configuration/edit-repositories/edit-repositories.component';
import { MetadataComponent } from '@components/configuration/metadata/metadata.component';
import { FourOhFourComponent } from '@components/four-oh-four/four-oh-four.component';
import { OverviewComponent } from '@components/graphs/overview/overview.component';
import { QuestionsCompletionComponent } from '@components/graphs/questions-completion/questions-completion.component';
import { StudentsCommitsComponent } from '@components/graphs/students-commits/students-commits.component';
import { HomeComponent } from '@components/home/home.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { AuthGuard } from '@guards/auth.guard';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateLoader, TranslateModule, TranslateService } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { AuthService } from '@services/auth.service';
import { CommitsService } from '@services/commits.service';
import { DataService } from '@services/data.service';
import { JsonManagerService } from '@services/json-manager.service';
import { ToastService } from '@services/toast.service';
import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import * as firebase from 'firebase/app';
import 'firebase/performance';
import { ChartsModule } from 'ng2-charts';
import { ClipboardModule } from 'ngx-clipboard';
import { MarkdownModule } from 'ngx-markdown';
import { NgxSpinnerModule } from 'ngx-spinner';
import { ToastrModule } from 'ngx-toastr';
import { TypeaheadModule } from 'ngx-type-ahead';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ModalAddRepositoriesComponent } from './components/configuration/edit-repositories/modal-add-repositories/modal-add-repositories.component';
import { EditSessionsComponent } from './components/configuration/edit-sessions/edit-sessions.component';

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

export function appInitializerFactory(translate: TranslateService, injector: Injector) {
  return () => new Promise<any>((resolve: any) => {
    const locationInitialized = injector.get(LOCATION_INITIALIZED, Promise.resolve(null));
    locationInitialized.then(() => {
      translate.addLangs(["en", "fr"]);
      translate.setDefaultLang('en');
      const langToSet = window.navigator.language ? window.navigator.language.slice(0, 2) : 'en';
      translate.use(langToSet).subscribe(() => {
        console.info(`Successfully initialized '${langToSet}' language.'`);
      }, err => {
        console.error(`Problem with '${langToSet}' language initialization. Language set to '${translate.defaultLang}'.`);
        resolve(null);
      }, () => {
        resolve(null);
      });
    });
  });
}

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    FourOhFourComponent,
    OverviewComponent,
    StudentsCommitsComponent,
    QuestionsCompletionComponent,
    MetadataComponent,
    EditRepositoriesComponent,
    ConfigurationComponent,
    EditSessionsComponent,
    ModalAddRepositoriesComponent
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
    ToastrModule.forRoot({
      maxOpened: 3,
      newestOnTop: false
    }),
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
    NgbModule,
    NgxDatatableModule
  ],
  providers: [
    AuthService,
    AuthGuard,
    CommitsService,
    JsonManagerService,
    DataService,
    ToastService,
    {
      provide: APP_INITIALIZER,
      useFactory: appInitializerFactory,
      deps: [TranslateService, Injector],
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor() { }
}

/**
 * Loader factory for translation service, using HTTP
 * @param httpClient
 */
export function HttpLoaderFactory(httpClient: HttpClient) {
  return new TranslateHttpLoader(httpClient);
}
