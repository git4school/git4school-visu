import { LOCATION_INITIALIZED, registerLocaleData } from "@angular/common";
import { HTTP_INTERCEPTORS, HttpClient, HttpClientModule } from "@angular/common/http";
import localeFr from "@angular/common/locales/fr";
import localeRu from "@angular/common/locales/ru";
import { GitlabAuthInterceptor } from "@interceptors/gitlab-auth.interceptor";
import { APP_INITIALIZER, Injector, LOCALE_ID, NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { SharedUiModule } from "./shared/ui/shared-ui.module";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { EditMilestoneComponent } from "@components/edit-milestone/edit-milestone.component";
import { FileChooserComponent } from "@components/file-chooser/file-chooser.component";
import { FourOhFourComponent } from "@components/four-oh-four/four-oh-four.component";
import { CommitsComponent } from "@components/graphs/commits/commits.component";
import { QuestionsCompletionComponent } from "@components/graphs/questions-completion/questions-completion.component";
import { StudentsComponent } from "@components/graphs/students/students.component";
import { AssignmentChooserComponent } from "@components/home/assignment-chooser/assignment-chooser.component";
import { ConfigurationComponent } from "@components/home/assignment-chooser/configuration/configuration.component";
import { EditRepositoriesComponent } from "@components/home/assignment-chooser/configuration/edit-repositories/edit-repositories.component";
// eslint-disable-next-line max-len
import { ModalAddRepositoriesComponent } from "@components/home/assignment-chooser/configuration/edit-repositories/modal-add-repositories/modal-add-repositories.component";
import { MetadataComponent } from "@components/home/assignment-chooser/configuration/metadata/metadata.component";
// eslint-disable-next-line max-len
import { QuestionsAssistantPopoverComponent } from "@components/home/assignment-chooser/configuration/metadata/questions-assistant-popover/questions-assistant-popover.component";
import { HomeComponent } from "@components/home/home.component";
import { QuestionsChooserComponent } from "@components/questions-chooser/questions-chooser.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { AuthGuard } from "@guards/auth.guard";
import { NgbActiveModal, NgbModule } from "@ng-bootstrap/ng-bootstrap";
import { TranslateLoader, TranslateModule, TranslateService } from "@ngx-translate/core";
import { TranslateHttpLoader } from "@ngx-translate/http-loader";
import { GithubAuthService } from "@services/github-auth.service";
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

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { EditSessionComponent } from "./components/edit-session/edit-session.component";
import { AuthLangNavItemComponent } from "./components/nav-items/auth-lang-nav-item/auth-lang-nav-item.component";
import { HelpNavItemComponent } from "./components/nav-items/help-nav-item/help-nav-item.component";
import { AppNavLayoutComponent } from "./components/nav-layouts/app-nav-layout/app-nav-layout.component";
import { OverviewGraphContextualMenuComponent } from "./components/overview-graph-contextual-menu/overview-graph-contextual-menu.component";
import { SidebarSettingsComponent } from "./components/nav-layouts/sidebar-settings/sidebar-settings.component";
import { AccountsComponent } from "./components/nav-layouts/sidebar-settings/accounts/accounts.component";
import { AddAccountModalComponent } from "./components/nav-layouts/sidebar-settings/accounts/add-account-modal/add-account-modal.component";
import { GitlabCallbackComponent } from "@components/auth-callback/gitlab-callback.component";

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
export function appInitializerFactory(translate: TranslateService, injector: Injector) {
  return () =>
    new Promise<any>((resolve: any) => {
      const locationInitialized = injector.get(LOCATION_INITIALIZED, Promise.resolve(null));
      locationInitialized.then(() => {
        registerLocaleData(localeFr);
        registerLocaleData(localeRu);
        translate.addLangs(["en", "fr", "ru"]);
        translate.setDefaultLang("en");
        const savedLang = localStorage.getItem("language");
        const browserLang = window.navigator.language ? window.navigator.language.slice(0, 2) : "en";
        const langToSet = savedLang || browserLang;
        translate.use(langToSet).subscribe(
          () => {},
          (err) => {
            resolve(null);
          },
          () => {
            resolve(null);
          },
        );
      });
    });
}

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    FourOhFourComponent,
    CommitsComponent,
    StudentsComponent,
    QuestionsCompletionComponent,
    MetadataComponent,
    QuestionsAssistantPopoverComponent,
    EditRepositoriesComponent,
    ConfigurationComponent,
    ModalAddRepositoriesComponent,
    AssignmentChooserComponent,
    FileChooserComponent,
    EditMilestoneComponent,
    QuestionsChooserComponent,
    AppNavLayoutComponent,
    AuthLangNavItemComponent,
    HelpNavItemComponent,
    EditSessionComponent,
    OverviewGraphContextualMenuComponent,
    SidebarSettingsComponent,
    AccountsComponent,
    AddAccountModalComponent,
    GitlabCallbackComponent,
  ],
  entryComponents: [AddAccountModalComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    ChartsModule,
    NgxSpinnerModule,
    FontAwesomeModule,
    SharedUiModule,
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
    GithubAuthService,
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
      useFactory: (translateService: TranslateService) => translateService.currentLang,
      deps: [TranslateService],
    },
    DatabaseService,
    NgbActiveModal,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: GitlabAuthInterceptor,
      multi: true,
    },
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
