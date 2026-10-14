import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import { GithubAuthService } from "@services/github-auth.service";
import { DataService } from "@services/data.service";
import { ThemeService } from "@services/theme.service";
import { WhatsNewService } from "@services/whats-new.service";
import "rxjs/add/observable/interval";
import { environment } from "@environments/environment";

/**
 * This component is the app component
 */
@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent implements OnInit {
  readonly isProduction = environment.production;
  /**
   * AppComponent constructor
   * @param githubAuthService Authentication service
   * @param dataService Service used to store and get data
   * @param router
   * @param translateService Service used to translate the application
   * @param themeService Service used to handle theme
   * @param whatsNewService Service handling the "What's New" modal
   */
  constructor(
    public githubAuthService: GithubAuthService,
    public dataService: DataService,
    private router: Router,
    public translateService: TranslateService,
    private themeService: ThemeService,
    private whatsNewService: WhatsNewService,
  ) {}

  /**
   * This method is called once the component is loaded.
   */
  ngOnInit(): void {
    this.openWhatsNewOnNewVersion();
  }

  /**
   * Shows the highlights of the running version once, when the user has never seen this version.
   */
  private openWhatsNewOnNewVersion(): void {
    if (!this.whatsNewService.shouldShow()) {
      return;
    }

    /* Double requestAnimationFrame: let the application shell paint before the modal slides in. */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.whatsNewService.showIfNeeded());
    });
  }
}
