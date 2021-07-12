import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { Forge, ForgeType } from "@models/Forge.model";
import { NgbTooltipConfig } from "@ng-bootstrap/ng-bootstrap";
import { TranslateService } from "@ngx-translate/core";
import { AuthService } from "@services/auth.service";
import { DataService } from "@services/data.service";
import * as Chart from "chart.js";
// import * as ChartDataLabels from "chartjs-plugin-datalabels";
import { default as ChartDataLabels } from "chartjs-plugin-datalabels";
import { environment } from "environments/environment";
import "rxjs/add/observable/interval";

/**
 * This component is the app component
 */
@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent implements OnInit, OnDestroy {
  /**
   * AppComponent constructor
   * @param authService Authentication service
   * @param dataService Service used to store and get data
   * @param router
   * @param translateService Service used to translate the application
   */
  constructor(
    public authService: AuthService,
    public dataService: DataService,
    private router: Router,
    public translateService: TranslateService,
    private ngbTooltipConfig: NgbTooltipConfig
  ) {
    ngbTooltipConfig.openDelay = 500;
    ngbTooltipConfig.triggers = "hover";
    ngbTooltipConfig.container = "body";
    ngbTooltipConfig.animation = true;
  }

  /**
   * This method is called once the component is loaded.
   * If the user is not signed in, call the the sign in method.
   */
  ngOnInit(): void {
    Chart.pluginService.unregister(ChartDataLabels);
    this.authService.loading = false;
    if (!this.authService.isSignedIn()) {
      this.authService.reauthenticate();
      this.authService.loading = true;
      this.authService
        .callback()
        .then(
          () => {
            this.authService.loading = false;
            this.dataService.forge = new Forge(
              "Github",
              environment.githubApiURL,
              ForgeType.Github,
              false
            );
            this.router.navigate(["overview"]);
          },
          () => {
            this.authService.loading = false;
          }
        )
        .catch(() => {
          this.authService.loading = false;
        });
    }
  }

  /**
   * This method is called when the component is destroyed.
   * Disconnects the user
   */
  ngOnDestroy(): void {
    this.authService.signOut();
  }
}
