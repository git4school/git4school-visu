import { Component, OnInit } from "@angular/core";
import { Assignment } from "@models/Assignment.model";
import { DataService } from "@services/data.service";
import { DatabaseService } from "@services/database.service";

@Component({
  selector: "assignment-chooser",
  templateUrl: "./assignment-chooser.component.html",
  styleUrls: ["./assignment-chooser.component.scss"],
  // changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssignmentChooserComponent implements OnInit {
  assignments: Assignment[];

  constructor(
    private databaseService: DatabaseService,
    private dataService: DataService
  ) {}

  ngOnInit(): void {
    this.assignments = [];
    this.loadAssignments();
  }

  async loadAssignments() {
    await this.databaseService
      .getAllAssignments()
      .then((assignments) => (this.assignments = assignments));
  }

  selectAssignment(assignment: Assignment) {
    this.dataService.assignment = assignment;
    console.log("this.dataService.assignment: ", this.dataService.assignment);
    this.dataService.repoToLoad = true;
  }

  deleteAssignment(assignment: Assignment) {
    this.databaseService.deleteAssignment(assignment.id);
    this.loadAssignments();
  }

  createAssignment() {
    this.dataService.assignment = new Assignment();
  }
}
