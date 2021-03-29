import { Component, OnInit } from "@angular/core";
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { TranslateService } from "@ngx-translate/core";
import { AssignmentsService } from "@services/assignments.service";
import { ToastService } from "@services/toast.service";

@Component({
  selector: "file-chooser",
  templateUrl: "./file-chooser.component.html",
  styleUrls: ["./file-chooser.component.scss"],
})
export class FileChooserComponent implements OnInit {
  constructor(
    private ngbActiveModal: NgbActiveModal,
    private toastService: ToastService,
    private translateService: TranslateService,
    private assignmentsService: AssignmentsService
  ) {}

  filename: string;

  ngOnInit(): void {
    this.filename = "";
  }

  changeListener($event): void {
    let file = $event.target.files[0];
    if (file) {
      this.filename = file.name;
      this.readFile(file);
    }
  }

  readFile(file: Blob) {
    this.assignmentsService
      .importAssignment(file)
      .then((assignment) => {
        this.ngbActiveModal.close(assignment);
      })
      .catch((err) => {
        this.toastService.error(
          this.translateService.instant("ERROR-TITLE-ERROR-OCCURED"),
          err
        );
      });
  }
}
