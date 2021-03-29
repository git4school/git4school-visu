import { Injectable } from "@angular/core";
import { Assignment } from "@models/Assignment.model";
import { plainToClass } from "class-transformer";
import Dexie from "dexie";
import { JsonManagerService } from "./json-manager.service";

@Injectable({
  providedIn: "root",
})
export class DatabaseService extends Dexie {
  assignments: Dexie.Table<Assignment, number>;
  constructor(private fileService: JsonManagerService) {
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

  exportDB(): Promise<any> {
    return this.getAllAssignments().then((assignments) => {
      return assignments.map((assignment) => {
        let { id, ...assignmentNoId } = assignment;
        return assignmentNoId;
      });
    });
  }

  importDB(assignments: Assignment[]): Promise<void> {
    return this.transaction("rw", this.assignments, (tx) => {
      assignments.forEach((assignment) => {
        this.saveAssignment(assignment);
      });
    });
  }
}
