import { Injectable } from "@angular/core";
import { Assignment } from "@models/Assignment.model";
import { plainToClass } from "class-transformer";
import Dexie from "dexie";
import { saveAs } from "file-saver";

@Injectable({
  providedIn: "root",
})
export class DatabaseService extends Dexie {
  assignments: Dexie.Table<Assignment, number>;
  constructor() {
    super("assignmentsdb");
    this.initDB();
  }

  initDB() {
    this.version(1).stores({
      assignments: "++id, metadata.title",
    });
    this.assignments = this.table("assignments");
    this.assignments.mapToClass(Assignment);
  }

  getAllAssignments(): Promise<Assignment[]> {
    return this.assignments
      .toArray()
      .then((assignments) => plainToClass(Assignment, assignments));
  }

  saveAssignment(assignment: Assignment): Promise<number> {
    return this.assignments.put(assignment);
  }

  deleteAssignment(id: number): Promise<void> {
    return this.assignments.delete(id);
  }

  getAssignmentById(id: number): Promise<Assignment> {
    return this.assignments
      .get(id)
      .then((assignment) => plainToClass(Assignment, assignment));
  }

  exportDB() {
    this.getAllAssignments().then((assignments) => {
      let assignmentsNoId = assignments.map((assignment) => {
        let { id, ...assignmentNoId } = assignment;
        return assignmentNoId;
      });

      let blob = new Blob(
        [JSON.stringify({ assignments: assignmentsNoId }, null, 2)],
        {
          type: "application/json",
        }
      );

      saveAs(blob, "assignments.json");
    });
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

  importDB(blob: Blob): Promise<void> {
    return blob
      .text()
      .then((text) => {
        let json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          json = Promise.reject("File could not be read");
        }
        return json;
      })
      .then((json) => {
        if (!json.assignments) {
          return Promise.reject("No assignment has been found");
        }

        let assignments = plainToClass<Assignment, Object>(
          Assignment,
          json.assignments
        );

        if (!this.verifyAssignments(assignments)) {
          return Promise.reject(
            "One or several assignments are not well formed"
          );
        }
        return assignments;
      })
      .then((assignments) => {
        return this.transaction("rw", this.assignments, (tx) => {
          assignments.forEach((assignment) => {
            this.saveAssignment(assignment);
          });
        });
      });
  }
}
