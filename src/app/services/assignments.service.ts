import { Injectable } from "@angular/core";
import { Assignment } from "@models/Assignment.model";
import { GitProviderType } from "@models/GitAuthProvider.model";
import { TranslateService } from "@ngx-translate/core";
import { plainToClass } from "class-transformer";
import { Subject } from "rxjs";
import { AccountsService } from "./accounts.service";
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
    private translateService: TranslateService,
    private accountsService: AccountsService,
  ) {}

  importAssignment(blob: Blob): Promise<Assignment> {
    return this.fileService.readFile(blob).then((json) => {
      let assignment = plainToClass(Assignment, json);
      if (!this.verifyAssignment(assignment)) {
        return Promise.reject(this.translateService.instant("ERROR-IMPORT-ASSIGNMENT-NOT-WELL-FORMED"));
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
        return Promise.reject(this.translateService.instant("ERROR-IMPORT-ASSIGNMENTS-NOT-FOUND"));
      }

      let assignments = plainToClass<Assignment, Object>(Assignment, json.assignments);

      if (!this.verifyAssignments(assignments)) {
        return Promise.reject(this.translateService.instant("ERROR-IMPORT-ASSIGNMENTS-NOT-WELL-FORMED"));
      }
      return this.databaseService.importDB(assignments);
    });
  }

  exportAssignments(assignmentsToExport?: any[]) {
    if (assignmentsToExport && assignmentsToExport.length > 0) {
      this.fileService.saveJsonFile({ assignments: assignmentsToExport }, "assignments");
    } else {
      this.databaseService.exportDB().then((assignments) => this.fileService.saveJsonFile({ assignments }, "assignments"));
    }
  }

  verifyAssignments(assignments: Assignment[]): boolean {
    let allAssignmentsGood = true;
    assignments.forEach((assignment) => {
      allAssignmentsGood = allAssignmentsGood && this.verifyAssignment(assignment);
    });
    return allAssignmentsGood;
  }

  verifyAssignment(assignment: Assignment): boolean {
    return !!assignment.title;
  }

  /**
   * Indicates whether the currently connected accounts can reach this assignment's forge
   * (shared by the list and folder views).
   */
  isAssignmentConnected(assignment: any): boolean {
    if (!assignment) {
      return false;
    }
    const provider = (assignment.provider || assignment.uiType || "github") as GitProviderType;
    const host = assignment.instanceHost || (assignment.resolvedInstanceHost ? assignment.resolvedInstanceHost : undefined);
    return this.accountsService.hasAccountForHost(provider, host);
  }

  /** True when the assignment lives on a self-hosted GitLab instance. */
  isCustomGitlab(assignment: any): boolean {
    if (!assignment) {
      return false;
    }
    const provider = assignment.provider || assignment.uiType;
    const host = assignment.instanceHost || assignment.resolvedInstanceHost;
    return provider === "gitlab" && Boolean(host && host !== "gitlab.com");
  }

  /** Tooltip shown when the assignment's forge account is not connected. */
  getDisconnectedTooltip(assignment: any): string {
    const provider = assignment?.provider || "github";
    const host = assignment?.instanceHost || assignment?.resolvedInstanceHost;
    if (provider === "gitlab") {
      if (host && host !== "gitlab.com") {
        return this.translateService.instant("HOME.MUST-LOGIN-ASSIGNMENT-GITLAB-CUSTOM", {
          host: assignment?.instanceName || host,
        });
      }
      return this.translateService.instant("HOME.MUST-LOGIN-ASSIGNMENT-GITLAB");
    }
    return this.translateService.instant("HOME.MUST-LOGIN-ASSIGNMENT-GITHUB");
  }

  /** Tooltip of the "load/select" action. */
  getAssignmentTooltip(assignment: any): string {
    if (this.isAssignmentConnected(assignment)) {
      return "HOME.SELECT-ASSIGNMENT-TOOLTIP";
    }
    return this.getDisconnectedTooltip(assignment);
  }

  /** Tooltip of the "configure" action. */
  getAssignmentEditTooltip(assignment: any): string {
    if (this.isAssignmentConnected(assignment)) {
      return "HOME.EDIT-ASSIGNMENT-TOOLTIP";
    }
    return this.getDisconnectedTooltip(assignment);
  }

  /** Tooltip of the "delete" action. */
  getAssignmentDeleteTooltip(assignment: any): string {
    if (this.isAssignmentConnected(assignment)) {
      return "HOME.DELETE-ASSIGNMENT-TOOLTIP";
    }
    return this.getDisconnectedTooltip(assignment);
  }

  /** Tooltip of the archive action, which becomes a restore action on an archived assignment. */
  getArchiveToggleTooltip(assignment: any): string {
    return this.translateService.instant(assignment?.archivedAt ? "HOME.RESTORE-ASSIGNMENT" : "HOME.ARCHIVE-ASSIGNMENT");
  }
}
