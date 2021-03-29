import { Component, OnInit } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { AssignmentsService } from "@services/assignments.service";
import { AuthService } from "@services/auth.service";
import { DataService } from "@services/data.service";
import { DatabaseService } from "@services/database.service";
import { JsonManagerService } from "@services/json-manager.service";

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
    private jsonManagerService: JsonManagerService,
    private assignmentsService: AssignmentsService,
    private databaseService: DatabaseService
  ) {}

  ngOnInit(): void {}

  download() {
    this.jsonManagerService.download();
  }

  openCurrentAssignmentConfig() {
    this.assignmentsService
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
