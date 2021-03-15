import { Injectable } from "@angular/core";
import { Assignment } from "@models/Assignment.model";
import { plainToClass } from "class-transformer";
import Dexie from "dexie";
import { exportDB, importInto, peakImportFile } from "dexie-export-import";

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

  exportDB(): Promise<Blob> {
    return exportDB(this, { prettyJson: true });
  }

  async importDB(blob: Blob): Promise<void> {
    let importData = await peakImportFile(blob);
    if (importData.data["incomplete"]) {
      return Promise.reject();
    } else {
      return importInto(this, blob, {
        clearTablesBeforeImport: true,
      });
    }
  }
}
