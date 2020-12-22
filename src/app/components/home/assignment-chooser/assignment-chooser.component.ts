import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { Assignment } from "@models/Assignment.model";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { DataService } from "@services/data.service";
import { DatabaseService } from "@services/database.service";
import { ConfigurationComponent } from "./configuration/configuration.component";

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
    private dataService: DataService,
    private modalService: NgbModal,
    private router: Router
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
    this.router.navigate(["overview"]);
  }

  deleteAssignment(assignment: Assignment) {
    this.databaseService.deleteAssignment(assignment.id);
    this.loadAssignments();
  }

  createAssignment() {
    let assignment = new Assignment();
    this.dataService.assignment = assignment;
    this.openConfigurationModal(assignment);
  }

  openConfigurationModal(assignment: Assignment) {
    let modalReference = this.modalService.open(ConfigurationComponent, {
      size: "xl",
    });
    modalReference.componentInstance.assignment = assignment;
    modalReference.result.finally(() => {
      this.loadAssignments();
      if (assignment.id === this.dataService.assignment?.id) {
        this.databaseService
          .getAssignmentById(assignment.id)
          .then((assignment) => (this.dataService.assignment = assignment));
      }
    });
  }
}
