import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import { GithubAuthService } from "@services/github-auth.service";
import { DataService } from "@services/data.service";
import { ThemeService } from "@services/theme.service";
import * as Chart from "chart.js";
// import * as ChartDataLabels from "chartjs-plugin-datalabels";
import { default as ChartDataLabels } from "chartjs-plugin-datalabels";
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
export class AppComponent implements OnInit, OnDestroy {
  readonly isProduction = environment.production;
  /**
   * AppComponent constructor
   * @param githubAuthService Authentication service
   * @param dataService Service used to store and get data
   * @param router
   * @param translateService Service used to translate the application
   * @param themeService Service used to handle theme
   */
  constructor(
    public githubAuthService: GithubAuthService,
    public dataService: DataService,
    private router: Router,
    public translateService: TranslateService,
    private themeService: ThemeService,
  ) {}

  /**
   * This method is called once the component is loaded.
   * If the user is not signed in, call the the sign in method.
   */
  ngOnInit(): void {
    Chart.pluginService.unregister(ChartDataLabels);
    this.githubAuthService.loading = false;
    if (!this.githubAuthService.isSignedIn()) {
      this.githubAuthService.reauthenticate();
    }
  }

  /**
   * This method is called when the component is destroyed.
   * Disconnects the user
   */
  ngOnDestroy(): void {
    this.githubAuthService.signOut();
  }
}
