import { Injectable } from "@angular/core";
import { Assignment } from "@models/Assignment.model";
import { plainToClass } from "class-transformer";
import { Subject } from "rxjs";
import { DatabaseService } from "./database.service";
import { JsonManagerService } from "./json-manager.service";

@Injectable({
  providedIn: "root",
})
export class AssignmentsService {
  assignmentModified = new Subject();

  constructor(
    private fileService: JsonManagerService,
    private databaseService: DatabaseService
  ) {}

  importAssignment(blob: Blob): Promise<Assignment> {
    return this.fileService.readFile(blob).then((json) => {
      let assignment = plainToClass(Assignment, json);
      if (!this.verifyAssignment(assignment)) {
        return Promise.reject("The assignment to import is not well formed");
      }
      return assignment;
    });
  }

  exportAssignment(assignment: Assignment) {
    this.fileService.saveJsonFile(assignment, assignment.title);
  }

  importAssignments(blob: Blob): Promise<void> {
    return this.fileService.readFile(blob).then((json) => {
      if (!json.assignments) {
        return Promise.reject("No assignment has been found");
      }

      let assignments = plainToClass<Assignment, Object>(
        Assignment,
        json.assignments
      );

      if (!this.verifyAssignments(assignments)) {
        return Promise.reject("One or several assignments are not well formed");
      }
      return this.databaseService.importDB(assignments);
    });
  }

  exportAssignments() {
    this.databaseService
      .exportDB()
      .then((assignments) =>
        this.fileService.saveJsonFile(
          { assignments: assignments },
          "assignments"
        )
      );
  }

  verifyAssignments(assignments: Assignment[]): boolean {
    let allAssignmentsGood = true;
    assignments.forEach((assignment) => {
      allAssignmentsGood =
        allAssignmentsGood && this.verifyAssignment(assignment);
    });
    return allAssignmentsGood;
  }

  verifyAssignment(assignment: Assignment): boolean {
    console.log(assignment);
    return !!assignment.title;
  }
}
