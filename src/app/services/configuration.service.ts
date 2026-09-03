import { Injectable } from "@angular/core";
import { ConfigurationComponent } from "@components/home/assignment-chooser/configuration/configuration.component";
import { Assignment } from "@models/Assignment.model";
import { TranslateService } from "@ngx-translate/core";
import { CustomModalService } from "@shared/ui/custom-modal/custom-modal.service";

@Injectable({
  providedIn: "root",
})
export class ConfigurationService {
  constructor(
    private translateService: TranslateService,
    private modalService: CustomModalService
  ) {}

  openConfigurationModal(assignment: Assignment): Promise<any> {
    let translation = this.translateService.instant("MESSAGE-UNSAVED-GUARD");
    let customModalRef = this.modalService.open(ConfigurationComponent, {
      size: "lg",
      beforeDismiss: () => {
        return (
          !customModalRef.componentInstance.isModified || confirm(translation)
        );
      },
    });
    customModalRef.componentInstance.assignment = assignment;
    customModalRef.componentInstance.modalRef = customModalRef;
    return customModalRef.result;
  }
}
