import { Injectable } from "@angular/core";
import { Assignment } from "@models/Assignment.model";
import { TranslateService } from "@ngx-translate/core";
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
    private databaseService: DatabaseService,
    private translateService: TranslateService
  ) {}

  importAssignment(blob: Blob): Promise<Assignment> {
    return this.fileService.readFile(blob).then((json) => {
      let assignment = plainToClass(Assignment, json);
      if (!this.verifyAssignment(assignment)) {
        return Promise.reject(
          this.translateService.instant(
            "ERROR-IMPORT-ASSIGNMENT-NOT-WELL-FORMED"
          )
        );
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
        return Promise.reject(
          this.translateService.instant("ERROR-IMPORT-ASSIGNMENTS-NOT-FOUND")
        );
      }

      let assignments = plainToClass<Assignment, Object>(
        Assignment,
        json.assignments
      );

      if (!this.verifyAssignments(assignments)) {
        return Promise.reject(
          this.translateService.instant(
            "ERROR-IMPORT-ASSIGNMENTS-NOT-WELL-FORMED"
          )
        );
      }
      return this.databaseService.importDB(assignments);
    });
  }

  exportAssignments() {
    this.databaseService
      .exportDB()
      .then((assignments) =>
        this.fileService.saveJsonFile({ assignments }, "assignments")
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
    return !!assignment.title;
  }
}
