import { Component, OnInit } from "@angular/core";
import { Assignment } from "@models/Assignment.model";
import { Milestone } from "@models/Milestone.model";
import { Repository } from "@models/Repository.model";
import { Session } from "@models/Session.model";
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { TranslateService } from "@ngx-translate/core";
import { ToastService } from "@services/toast.service";
import { Utils } from "@services/utils";
import * as Ajv from "ajv";

@Component({
  selector: "file-chooser",
  templateUrl: "./file-chooser.component.html",
  styleUrls: ["./file-chooser.component.scss"],
})
export class FileChooserComponent implements OnInit {
  constructor(
    private ngbActiveModal: NgbActiveModal,
    private toastService: ToastService,
    private translateService: TranslateService
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

  verifyJSON(json) {
    const schema = Utils.CONF_FILE_JSON_SCHEMA;
    let ajv = new Ajv({ $data: true, allErrors: true, verbose: true });
    let valid = ajv.validate(schema, json);

    if (!valid) {
      let errorMessage =
        "&emsp;" +
        ajv.errors
          .map((error) => {
            return error.dataPath + " " + error.message;
          })
          .join("<br>&emsp;");
      this.toastService.error(
        this.translateService.instant("INVALID-CONF-FILE"),
        errorMessage
      );

      return false;
    }

    return true;
  }

  getAssignmentFromFile(text): Assignment {
    let assignment = new Assignment();
    assignment.repositories = text.repositories
      .filter((repository) =>
        repository.url.match(/https:\/\/github.com\/[^\/]*\/[^\/]*/)
      )
      .map((repository) => Repository.withJSON(repository));
    if (text.repositories.length !== assignment.repositories.length) {
      let translations = this.translateService.instant([
        "ERRORS.WARNING",
        "ERRORS.INVALID-URLS",
      ]);
      this.toastService.warning(
        translations["ERRORS.WARNING"],
        translations["ERRORS.INVALID-URLS"]
      );
    }
    assignment.startDate = text.startDate;
    assignment.endDate = text.endDate;
    assignment.title = text.title;
    assignment.course = text.course;
    assignment.program = text.program;
    assignment.year = text.year;
    assignment.questions = text.questions;
    assignment.corrections = text.corrections
      ? text.corrections.map((data) => Milestone.withJSON(data, "corrections"))
      : [];
    assignment.sessions = text.sessions
      ? text.sessions.map((data) => Session.withJSON(data))
      : [];
    assignment.reviews = text.reviews
      ? text.reviews.map((data) => Milestone.withJSON(data, "reviews"))
      : [];
    assignment.others = text.others
      ? text.others.map((data) => Milestone.withJSON(data, "others"))
      : [];
    return assignment;
  }

  readFile(file: Blob) {
    const myReader: FileReader = new FileReader();
    myReader.onloadend = (e) => {
      let text = null;
      try {
        text = JSON.parse(myReader.result.toString());
      } catch (e) {
        this.toastService.error(
          this.translateService.instant("INVALID-JSON"),
          e.message
        );
      }
      if (text && this.verifyJSON(text)) {
        let assignment = this.getAssignmentFromFile(text);
        this.ngbActiveModal.close(assignment);
      }
    };
    myReader.readAsText(file);
  }
}
