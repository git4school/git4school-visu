import { Component, Input, OnInit } from "@angular/core";
import { FileChooserComponent } from "@components/file-chooser/file-chooser.component";
import { Assignment } from "@models/Assignment.model";
import { NgbActiveModal, NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { TranslateService } from "@ngx-translate/core";
import { DataService } from "@services/data.service";
import { ToastService } from "@services/toast.service";

@Component({
  templateUrl: "./configuration.component.html",
  styleUrls: ["./configuration.component.scss"],
})
export class ConfigurationComponent implements OnInit {
  @Input()
  assignment: Assignment;
  metadataModified: boolean;
  repositoriesModified: boolean;
  sessionsModified: boolean;

  constructor(
    public translateService: TranslateService,
    public dataService: DataService,
    private toastService: ToastService,
    public activeModalService: NgbActiveModal,
    private modalService: NgbModal
  ) {}

  ngOnInit(): void {
    this.metadataModified = false;
    this.repositoriesModified = false;
    this.sessionsModified = false;
  }

  get isModified() {
    return (
      this.metadataModified ||
      this.repositoriesModified ||
      this.sessionsModified
    );
  }

  saveMetadata(metadata) {
    this.assignment.metadata = metadata;

    this.metadataModified = false;

    this.saveAssignment();
  }

  saveRepositories(repositories) {
    this.assignment.repositories = repositories;

    this.repositoriesModified = false;

    this.saveAssignment();
  }

  saveSessions(sessions) {
    this.assignment.sessions = sessions;

    this.sessionsModified = false;

    this.saveAssignment();
  }

  private saveAssignment() {
    this.dataService
      .saveData(this.assignment)
      .then(() => this.successToast())
      .catch(() => this.errorToast());
  }

  openUploadFileModal() {
    let modalReference = this.modalService.open(FileChooserComponent, {});
    modalReference.result.then((assignment) => {
      assignment.id = this.assignment.id;
      this.assignment = assignment;
      this.saveAssignment();
      this.activeModalService.close();
    });
  }

  successToast() {
    let translations = this.translateService.instant([
      "SUCCESS",
      "SUCCESS-MESSAGE",
    ]);
    this.toastService.success(
      translations["SUCCESS"],
      translations["SUCCESS-MESSAGE"]
    );
  }

  errorToast(): any {
    throw new Error("Method not implemented.");
  }
}
