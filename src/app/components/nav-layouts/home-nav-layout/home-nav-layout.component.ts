import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import { AuthService } from "@services/auth.service";
import { DataService } from "@services/data.service";
import * as Chart from "chart.js";
import { default as ChartDataLabels } from "chartjs-plugin-datalabels";

@Component({
  selector: "app-home-nav-layout",
  templateUrl: "./home-nav-layout.component.html",
  styleUrls: ["./home-nav-layout.component.scss"],
  // changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeNavLayoutComponent implements OnInit {
  loading;

  constructor(
    public authService: AuthService,
    public dataService: DataService,
    private router: Router,
    public translateService: TranslateService
  ) {}

  ngOnInit(): void {
    this.loading = false;
    Chart.pluginService.unregister(ChartDataLabels);
    if (!this.authService.isSignedIn()) {
      this.loading = true;
      this.authService
        .callback()
        .then(
          () => {
            this.loading = false;
            this.router.navigate(["overview"]);
          },
          () => {
            this.loading = false;
          }
        )
        .catch(() => (this.loading = false));
    }
  }

  changeLanguage(language: string) {
    this.translateService.use(language);
  }

  /**
   * Signs in
   */
  onSignInGithub() {
    this.authService.signIn();
  }

  /**
   * Signs out
   */
  onSignOut() {
    this.authService.signOut();
  }
}
