import { Component, OnInit, TemplateRef, ViewChild } from "@angular/core";
import { Router } from "@angular/router";
import { Assignment } from "@models/Assignment.model";
import {
  NgbActiveModal,
  NgbModal,
  NgbModalRef,
} from "@ng-bootstrap/ng-bootstrap";
import { TranslateService } from "@ngx-translate/core";
import { AssignmentsService } from "@services/assignments.service";
import { AuthService } from "@services/auth.service";
import { DataService } from "@services/data.service";
import { DatabaseService } from "@services/database.service";
import { ToastService } from "@services/toast.service";
import { saveAs } from "file-saver";

@Component({
  selector: "assignment-chooser",
  templateUrl: "./assignment-chooser.component.html",
  styleUrls: ["./assignment-chooser.component.scss"],
  // changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssignmentChooserComponent implements OnInit {
  @ViewChild("importConfirmation")
  private importConfirmation: TemplateRef<any>;
  assignments: Assignment[];
  modalRef: NgbModalRef;

  constructor(
    private databaseService: DatabaseService,
    private dataService: DataService,
    private modalService: NgbModal,
    private router: Router,
    public authService: AuthService,
    private translateService: TranslateService,
    private toastService: ToastService,
    public activeModalService: NgbActiveModal,
    private assignmentsService: AssignmentsService
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
    if (this.dataService.repoToLoad) {
      this.router.navigate(["overview"]);
    }
  }

  deleteAssignment(assignment: Assignment) {
    this.databaseService.deleteAssignment(assignment.id);
    this.loadAssignments();
  }

  createAssignment() {
    let assignment = new Assignment();
    this.openConfigurationModal(assignment);
  }

  openConfigurationModal(assignment: Assignment) {
    this.assignmentsService.openConfigurationModal(assignment).finally(() => {
      this.loadAssignments();
      if (assignment.id && assignment.id === this.dataService.assignment?.id) {
        this.databaseService
          .getAssignmentById(assignment.id)
          .then((assignment) => (this.dataService.assignment = assignment));
      }
    });
  }

  exportDB() {
    this.databaseService
      .exportDB()
      .then((blob) => saveAs(blob, "assignments.json"));
  }

  importDB(blob: Blob) {
    let translations = this.translateService.instant([
      "SUCCESS",
      "ERROR",
      "IMPORT-SUCCESS",
      "IMPORT-ERROR",
    ]);
    this.databaseService
      .importDB(blob)
      .then(() => {
        this.loadAssignments();
        this.toastService.success(
          translations["SUCCESS"],
          translations["IMPORT-SUCCESS"]
        );
      })
      .catch(() => {
        this.toastService.error(
          translations["ERROR"],
          translations["IMPORT-ERROR"]
        );
      });
  }

  changeListener($event): void {
    let file = $event.target.files[0];
    if (file) {
      this.openImportConfirmation().then(
        () => this.importDB(file),
        () => {}
      );
    }
  }

  openImportConfirmation(): Promise<any> {
    this.modalRef = this.modalService.open(this.importConfirmation);
    return this.modalRef.result;
  }
}
