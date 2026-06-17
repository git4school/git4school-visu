import { Component, OnInit } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { AssignmentsService } from "@services/assignments.service";
import { AuthService } from "@services/auth.service";
import { ConfigurationService } from "@services/configuration.service";
import { DataService } from "@services/data.service";
import { DatabaseService } from "@services/database.service";
import { ThemeService } from "@services/theme.service";

@Component({
  selector: "app-app-nav-layout",
  templateUrl: "./app-nav-layout.component.html",
  styleUrls: ["./app-nav-layout.component.scss"],
})
export class AppNavLayoutComponent implements OnInit {
  constructor(
    public authService: AuthService,
    public dataService: DataService,
    public translateService: TranslateService,
    private assignmentsService: AssignmentsService,
    private databaseService: DatabaseService,
    private configurationService: ConfigurationService,
    public themeService: ThemeService
  ) {}

  isSidebarOpen: boolean = false;

  ngOnInit(): void {}

  get truncatedTitle(): string {
    const title = this.dataService.title;
    if (!title) return '';
    return title.length > 30 ? title.substring(0, 27) + '...' : title;
  }

  openCurrentAssignmentConfig() {
    this.configurationService
      .openConfigurationModal(this.dataService.assignment)
      .finally(() => {
        if (this.dataService.repoToLoad) {
          this.databaseService
            .getAssignmentById(this.dataService.assignment.id)
            .then((assignment) => {
              this.dataService.assignment = assignment;
              this.assignmentsService.assignmentModified.next();
            });
        }
      });
  }
}
