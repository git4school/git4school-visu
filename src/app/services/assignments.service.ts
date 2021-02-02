import { Injectable } from "@angular/core";
import { ConfigurationComponent } from "@components/home/assignment-chooser/configuration/configuration.component";
import { Assignment } from "@models/Assignment.model";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { TranslateService } from "@ngx-translate/core";
import { Subject } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class AssignmentsService {
  assignmentModified = new Subject();

  constructor(
    private translateService: TranslateService,
    private modalService: NgbModal
  ) {}

  openConfigurationModal(assignment: Assignment): Promise<any> {
    let translation = this.translateService.instant("MESSAGE-UNSAVED-GUARD");
    let modalReference = this.modalService.open(ConfigurationComponent, {
      size: "xl",
      beforeDismiss: () => {
        return (
          !modalReference.componentInstance.isModified || confirm(translation)
        );
      },
    });
    modalReference.componentInstance.assignment = assignment;
    return modalReference.result;
  }
}
