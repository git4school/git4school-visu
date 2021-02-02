import { Component, OnInit } from "@angular/core";
import { Milestone } from "@models/Milestone.model";
import { Repository } from "@models/Repository.model";
import { AssignmentsService } from "@services/assignments.service";
import { DataService } from "@services/data.service";
import { LoaderService } from "@services/loader.service";
import { Subscription } from "rxjs";

@Component({
  template: ``,
})
export abstract class BaseGraphComponent implements OnInit {
  public loading = false;

  constructor(
    protected loaderService: LoaderService,
    protected assignmentsService: AssignmentsService,
    protected dataService: DataService
  ) {}

  ngOnInit(): void {}

  subscribeAssignmentModified(): Subscription {
    return this.assignmentsService.assignmentModified.subscribe(() => {
      this.loadGraph(this.dataService.startDate, this.dataService.endDate);
    });
  }

  unsubscribeAssignmentModified(assignmentsModified$: Subscription) {
    assignmentsModified$.unsubscribe();
  }

  abstract loadGraph(startDate?: string, endDate?: string);

  loadGraphMetadata(
    repositories: Repository[],
    reviews: Milestone[],
    corrections: Milestone[],
    questions
  ) {
    this.loaderService.loadCommitsMetadata(
      repositories,
      reviews,
      corrections,
      questions
    );
    this.loadGraphDataAndRefresh();
  }

  abstract loadGraphDataAndRefresh();
}
