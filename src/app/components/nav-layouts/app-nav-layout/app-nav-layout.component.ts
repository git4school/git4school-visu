import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import { AssignmentsService } from "@services/assignments.service";
import { AuthService } from "@services/auth.service";
import { DataService } from "@services/data.service";
import { JsonManagerService } from "@services/json-manager.service";
import * as Chart from "chart.js";
import { default as ChartDataLabels } from "chartjs-plugin-datalabels";

@Component({
  selector: "app-app-nav-layout",
  templateUrl: "./app-nav-layout.component.html",
  styleUrls: ["./app-nav-layout.component.scss"],
  // changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppNavLayoutComponent implements OnInit {
  loading = false;

  constructor(
    public authService: AuthService,
    public dataService: DataService,
    private router: Router,
    public translateService: TranslateService,
    private jsonManagerService: JsonManagerService,
    private assignmentsService: AssignmentsService
  ) {}

  ngOnInit(): void {
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

  download() {
    this.jsonManagerService.download();
  }

  openCurrentAssignmentConfig() {
    this.assignmentsService
      .openConfigurationModal(this.dataService.assignment)
      .finally(() => {});
  }
}
