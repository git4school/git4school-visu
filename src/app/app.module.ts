import { LOCATION_INITIALIZED, registerLocaleData } from "@angular/common";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import localeFr from "@angular/common/locales/fr";
import { APP_INITIALIZER, Injector, LOCALE_ID, NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { EditMilestoneComponent } from "@components/edit-milestone/edit-milestone.component";
import { FileChooserComponent } from "@components/file-chooser/file-chooser.component";
import { FourOhFourComponent } from "@components/four-oh-four/four-oh-four.component";
import { OverviewComponent } from "@components/graphs/overview/overview.component";
import { QuestionsCompletionComponent } from "@components/graphs/questions-completion/questions-completion.component";
import { StudentsCommitsComponent } from "@components/graphs/students-commits/students-commits.component";
import { AssignmentChooserComponent } from "@components/home/assignment-chooser/assignment-chooser.component";
import { ConfigurationComponent } from "@components/home/assignment-chooser/configuration/configuration.component";
import { EditRepositoriesComponent } from "@components/home/assignment-chooser/configuration/edit-repositories/edit-repositories.component";
import { ModalAddRepositoriesComponent } from "@components/home/assignment-chooser/configuration/edit-repositories/modal-add-repositories/modal-add-repositories.component";
import { EditSessionsComponent } from "@components/home/assignment-chooser/configuration/edit-sessions/edit-sessions.component";
import { MetadataComponent } from "@components/home/assignment-chooser/configuration/metadata/metadata.component";
import { HomeComponent } from "@components/home/home.component";
import { QuestionsChooserComponent } from "@components/questions-chooser/questions-chooser.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { AuthGuard } from "@guards/auth.guard";
import { NgbActiveModal, NgbModule } from "@ng-bootstrap/ng-bootstrap";
import {
  TranslateLoader,
  TranslateModule,
  TranslateService,
} from "@ngx-translate/core";
import { TranslateHttpLoader } from "@ngx-translate/http-loader";
import { AuthService } from "@services/auth.service";
import { CommitsService } from "@services/commits.service";
import { DataService } from "@services/data.service";
import { DatabaseService } from "@services/database.service";
import { JsonManagerService } from "@services/json-manager.service";
import { ToastService } from "@services/toast.service";
import { NgxDatatableModule } from "@swimlane/ngx-datatable";
import * as firebase from "firebase/app";
import "firebase/performance";
import { ChartsModule } from "ng2-charts";
import { ClipboardModule } from "ngx-clipboard";
import { MarkdownModule } from "ngx-markdown";
import { NgxSpinnerModule } from "ngx-spinner";
import { ToastrModule } from "ngx-toastr";
import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { AuthLangNavItemComponent } from "./components/nav-items/auth-lang-nav-item/auth-lang-nav-item.component";
import { HelpNavItemComponent } from "./components/nav-items/help-nav-item/help-nav-item.component";
import { AppNavLayoutComponent } from "./components/nav-layouts/app-nav-layout/app-nav-layout.component";
import { HomeNavLayoutComponent } from "./components/nav-layouts/home-nav-layout/home-nav-layout.component";
import { EditSessionComponent } from './components/edit-session/edit-session.component';

/**
 * Firebase configuration file
 */
const firebaseConfig = {
  apiKey: "AIzaSyA3kJGK7-b7YbLnb0RBc38kTfqkc_fT0xY",
  authDomain: "git4school.firebaseapp.com",
  databaseURL: "https://git4school.firebaseio.com",
  projectId: "git4school",
  storageBucket: "",
  messagingSenderId: "896582512902",
  appId: "1:896582512902:web:db9dc0ffe2590b10",
};

firebase.initializeApp(firebaseConfig);

/**
 * Called at the initialization of the application, which waits for the end of this function to start.
 * It's here that we initialize the localization and the translate service :
 *  - If possible, the application is initialized with the browser language, otherwise it uses english localization
 *  - It loads all the translations so we can get them instantly later
 *
 * @param translate The translation service
 * @param injector The injector service
 */
export function appInitializerFactory(
  translate: TranslateService,
  injector: Injector
) {
  return () =>
    new Promise<any>((resolve: any) => {
      const locationInitialized = injector.get(
        LOCATION_INITIALIZED,
        Promise.resolve(null)
      );
      locationInitialized.then(() => {
        registerLocaleData(localeFr);
        translate.addLangs(["en", "fr"]);
        translate.setDefaultLang("en");
        const langToSet = window.navigator.language
          ? window.navigator.language.slice(0, 2)
          : "en";
        translate.use(langToSet).subscribe(
          () => {},
          (err) => {
            resolve(null);
          },
          () => {
            resolve(null);
          }
        );
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
    ModalAddRepositoriesComponent,
    AssignmentChooserComponent,
    FileChooserComponent,
    EditMilestoneComponent,
    QuestionsChooserComponent,
    HomeNavLayoutComponent,
    AppNavLayoutComponent,
    AuthLangNavItemComponent,
    HelpNavItemComponent,
    EditSessionComponent,
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
      newestOnTop: false,
    }),
    BrowserAnimationsModule,
    ClipboardModule,
    MarkdownModule.forRoot(),
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient],
      },
    }),
    NgbModule,
    NgxDatatableModule,
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
      multi: true,
    },
    {
      provide: LOCALE_ID,
      useFactory: (translateService: TranslateService) =>
        translateService.currentLang,
      deps: [TranslateService],
    },
    DatabaseService,
    NgbActiveModal,
  ],
  bootstrap: [AppComponent],
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
