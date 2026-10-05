import { Injectable } from "@angular/core";
import { ConfigurationComponent } from "@components/home/assignment-chooser/configuration/configuration.component";
import { Assignment } from "@models/Assignment.model";
import { CustomModalService } from "@shared/ui/custom-modal/custom-modal.service";

@Injectable({
  providedIn: "root",
})
export class ConfigurationService {
  constructor(private modalService: CustomModalService) {}

  openConfigurationModal(assignment: Assignment): Promise<any> {
    const customModalRef = this.modalService.open(ConfigurationComponent, {
      size: "lg",
      // Flush pending autosave before dismissing so the caller reloads fresh data (see ADR 0010).
      beforeDismiss: () => Promise.resolve(customModalRef.componentInstance?.flush()).then(() => true),
    });
    customModalRef.componentInstance.assignment = assignment;
    customModalRef.componentInstance.modalRef = customModalRef;
    return customModalRef.result;
  }
}
