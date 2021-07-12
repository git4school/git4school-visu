import { Injectable } from "@angular/core";
import { Assignment } from "@models/Assignment.model";
import { Forge, ForgeType } from "@models/Forge.model";
import { plainToClass } from "class-transformer";
import Dexie from "dexie";
import { environment } from "environments/environment";
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
    this.version(2)
      .stores({
        assignments: "++id, metadata.title, [forge.type+forge.name]",
      })
      .upgrade((trans) => {
        let githubForge = new Forge(
          "Github",
          environment.githubApiURL,
          ForgeType.Github,
          false
        );
        return trans
          .table("assignments")
          .toCollection()
          .modify((assignment) => {
            assignment.forge = githubForge;
          });
      });
    this.assignments = this.table("assignments");
    this.assignments.mapToClass(Assignment);
  }

  getAllAssignments(forge: Forge): Promise<Assignment[]> {
    console.log("forge: ", forge);
    return this.assignments
      .where("[forge.type+forge.name]")
      .equals([forge.type, forge.name])
      .toArray()
      .then((assignments) => plainToClass(Assignment, assignments));
    // return this.assignments
    //   .toArray()
    //   .then((assignments) => plainToClass(Assignment, assignments));
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

  exportDB(forge: Forge): Promise<any> {
    return this.getAllAssignments(forge).then((assignments) => {
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
