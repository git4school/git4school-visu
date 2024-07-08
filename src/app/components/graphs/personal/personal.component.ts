import { Component, OnInit } from "@angular/core";
import { BaseGraphComponent } from "../base-graph.component";
import { DataService } from "../../../services/data.service";
import { CommitsService } from "../../../services/commits.service";
import { TranslateService } from "@ngx-translate/core";
import { LoaderService } from "../../../services/loader.service";
import { AssignmentsService } from "../../../services/assignments.service";

@Component({
  selector: "personal",
  templateUrl: "./personal.component.html",
  styleUrls: ["./personal.component.scss"],
})
export class PersonalComponent extends BaseGraphComponent implements OnInit {
  /**
   * StudentsCommitsComponent constructor
   * @param dataService Service used to store and get data
   * @param commitsService Service used to update dict variable
   * @param translateService Service used to translate the application
   */
  constructor(
    public dataService: DataService,
    private commitsService: CommitsService,
    public translateService: TranslateService,
    protected loaderService: LoaderService,
    protected assignmentsService: AssignmentsService
  ) {
    super(loaderService, assignmentsService, dataService);
  }

  /**
   * Updates dict variable with students data and loads graph labels which displays data on the graph
   */
  loadGraphDataAndRefresh() {
    let translations = this.translateService.instant([
      "STUDENT",
      "COMMITS-COUNT",
      "COMMITS-PERCENTAGE",
    ]);
  }

  loadGraph(startDate?: string, endDate?: string) {
    this.loading = true;
    this.loaderService.loadRepositories(startDate, endDate).subscribe(() => {
      this.loadGraphMetadata(
        this.dataService.repositories,
        this.dataService.reviews,
        this.dataService.corrections,
        this.dataService.questions
      );
      this.loading = false;
    });
  }
}
