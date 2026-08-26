import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { FileChooserComponent } from "@components/file-chooser/file-chooser.component";
import { Assignment } from "@models/Assignment.model";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { Optional } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { DataService } from "@services/data.service";
import { ToastService } from "@services/toast.service";
import { CustomModalRef } from "@shared/ui/custom-modal/custom-modal-ref";
import { CustomModalService } from "@shared/ui/custom-modal/custom-modal.service";
import { MetadataComponent } from "./metadata/metadata.component";
import { EditRepositoriesComponent } from "./edit-repositories/edit-repositories.component";

@Component({
  selector: "app-configuration",
  templateUrl: "./configuration.component.html",
  styleUrls: ["./configuration.component.scss"],
})
export class ConfigurationComponent implements OnInit {
  @Input() assignment: Assignment;
  @Input() modalRef?: any;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Assignment>();

  @ViewChild("metadataComp") metadataComp: MetadataComponent;
  @ViewChild("reposComp") reposComp: EditRepositoriesComponent;

  metadataModified: boolean;
  repositoriesModified: boolean;
  activeTab: "metadata" | "repositories" = "metadata";
  reposInitialized = false;

  constructor(
    public translateService: TranslateService,
    public dataService: DataService,
    private toastService: ToastService,
    private ngbModalService: NgbModal,
    private modalService: CustomModalService,
    @Optional() public activeModal: CustomModalRef
  ) {}

  ngOnInit(): void {
    this.metadataModified = false;
    this.repositoriesModified = false;
  }

  selectTab(tab: "metadata" | "repositories") {
    this.activeTab = tab;
    if (tab === "repositories") {
      this.reposInitialized = true;
    }
  }

  get isModified() {
    return (
      this.metadataModified ||
      this.repositoriesModified ||
      this.assignment.id === -1
    );
  }

  canSave(): boolean {
    const metadataValid = this.metadataComp
      ? this.metadataComp.metadataForm.valid
      : true;
    const reposValid = this.reposComp
      ? this.reposComp.formGroups.every((fg) => fg.valid || fg.disabled)
      : true;
    return metadataValid && reposValid;
  }

  onSaveGlobal() {
    // Collect data from child components if they exist
    if (this.metadataComp) {
      let modifiedMetadata = this.metadataComp.metadataForm.value;
      this.assignment.metadata.title = modifiedMetadata.title;
      this.assignment.metadata.course = modifiedMetadata.course;
      this.assignment.metadata.program = modifiedMetadata.program;
      this.assignment.metadata.year = modifiedMetadata.year;
      this.assignment.metadata.startDate = modifiedMetadata.startDate;
      this.assignment.metadata.endDate = modifiedMetadata.endDate;
      this.assignment.metadata.questions = modifiedMetadata.questions;
      this.assignment.metadata.defaultSessionDuration =
        modifiedMetadata.defaultSessionDuration;
    }

    if (this.reposComp) {
      this.assignment.repositories = this.reposComp.getFormControls.map(
        (row) => row.value
      );
    }

    this.metadataModified = false;
    this.repositoriesModified = false;

    this.saveAssignment();
  }

  onCancel() {
    this.close.emit();
    if (this.modalRef) {
      this.modalRef.dismiss("cancel");
    } else if (this.activeModal) {
      this.activeModal.dismiss("cancel");
    }
  }

  openUploadFileModal() {
    let modalReference = this.ngbModalService.open(FileChooserComponent, {});
    modalReference.result
      .then((assignment) => {
        assignment.id = this.assignment.id;
        this.assignment = assignment;
        this.saveAssignment();
      })
      .catch(() => {});
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

  errorToast(): any {}

  private saveAssignment() {
    this.dataService.repoToLoad = true;
    // If it's a new assignment (id === -1), delete the temporary ID so DatabaseService creates a real one
    const isNew = this.assignment.id === -1;
    let assignmentToSave = Object.assign(new Assignment(), this.assignment);
    if (isNew) {
      delete assignmentToSave.id;
    }

    this.dataService
      .saveData(assignmentToSave)
      .then((id) => {
        this.assignment.id = id;
        this.successToast();
        this.saved.emit(this.assignment);
        if (this.modalRef) {
          this.modalRef.close(this.assignment);
        } else if (this.activeModal) {
          this.activeModal.close(this.assignment);
        }
      })
      .catch(() => this.errorToast());
  }
}
