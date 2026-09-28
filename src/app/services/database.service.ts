import { Injectable } from "@angular/core";
import { Assignment } from "@models/Assignment.model";
import { plainToClass } from "class-transformer";
import Dexie from "dexie";
import { JsonManagerService } from "./json-manager.service";
import { Subject } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class DatabaseService extends Dexie {
  assignments: Dexie.Table<Assignment, number>;
  dbChanged = new Subject<void>();

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
        assignments: "++id, metadata.title",
      })
      .upgrade((tx) => {
        return tx
          .table("assignments")
          .toCollection()
          .modify((assignment) => {
            if (assignment.sessions && Array.isArray(assignment.sessions)) {
              assignment.sessions.forEach((session: any) => {
                if (session.label === undefined) {
                  session.label = "";
                }
              });
            }
          });
      });
    this.version(3)
      .stores({
        assignments: "++id, metadata.title",
      })
      .upgrade((tx) => {
        return tx
          .table("assignments")
          .toCollection()
          .modify((assignment) => {
            if (assignment.metadata) {
              if (assignment.metadata.closingMode === undefined) {
                assignment.metadata.closingMode = "standard";
              }
              if (assignment.metadata.customClosingKeywords === undefined) {
                assignment.metadata.customClosingKeywords = [];
              }
            }
          });
      });
    this.version(4)
      .stores({
        assignments: "++id, metadata.title, provider",
      })
      .upgrade((tx) => {
        return tx
          .table("assignments")
          .toCollection()
          .modify((assignment) => {
            if (!assignment.provider) {
              assignment.provider = "github";
            }
            if (assignment.repositories && Array.isArray(assignment.repositories)) {
              assignment.repositories.forEach((repo: any) => {
                if (!repo.provider) {
                  repo.provider = "github";
                }
              });
            }
          });
      });
    this.version(5)
      .stores({
        assignments: "++id, metadata.title, provider, instanceHost",
      })
      .upgrade((tx) => {
        return tx
          .table("assignments")
          .toCollection()
          .modify((assignment) => {
            if (!assignment.provider) {
              assignment.provider = "github";
            }
            if (!assignment.instanceHost) {
              if (assignment.provider === "gitlab") {
                const firstRepoUrl = assignment.repositories?.[0]?.url;
                if (firstRepoUrl) {
                  const sshMatch = firstRepoUrl.match(/^git@([^:]+):/);
                  if (sshMatch && sshMatch[1]) {
                    assignment.instanceHost = sshMatch[1];
                  } else {
                    try {
                      assignment.instanceHost = new URL(firstRepoUrl).hostname;
                    } catch {
                      assignment.instanceHost = "gitlab.com";
                    }
                  }
                } else {
                  assignment.instanceHost = "gitlab.com";
                }
              } else {
                assignment.instanceHost = "github.com";
              }
            }
            if (assignment.repositories && Array.isArray(assignment.repositories)) {
              assignment.repositories.forEach((repo: any) => {
                if (!repo.provider) {
                  repo.provider = assignment.provider || "github";
                }
              });
            }
          });
      });
    this.assignments = this.table("assignments");
    this.assignments.mapToClass(Assignment);
  }

  getAllAssignments(): Promise<Assignment[]> {
    return this.assignments.toArray().then((assignments) =>
      plainToClass(Assignment, assignments).map((assignment) => {
        if (!assignment.provider) {
          assignment.provider = "github";
        }
        if (!assignment.instanceHost) {
          assignment.instanceHost = assignment.resolvedInstanceHost;
        }
        return assignment;
      }),
    );
  }

  saveAssignment(assignment: Assignment): Promise<number> {
    if (!assignment.provider) {
      assignment.provider = "github";
    }
    if (!assignment.instanceHost) {
      assignment.instanceHost = assignment.resolvedInstanceHost;
    }
    return this.assignments.put(assignment).then((id) => {
      this.dbChanged.next();
      return id;
    });
  }

  deleteAssignment(id: number): Promise<void> {
    return this.assignments.delete(id).then(() => {
      this.dbChanged.next();
    });
  }

  getAssignmentById(id: number): Promise<Assignment> {
    return this.assignments.get(id).then((assignment) => {
      if (!assignment) {
        return assignment;
      }
      const hydrated = plainToClass(Assignment, assignment);
      if (!hydrated.provider) {
        hydrated.provider = "github";
      }
      if (!hydrated.instanceHost) {
        hydrated.instanceHost = hydrated.resolvedInstanceHost;
      }
      return hydrated;
    });
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
