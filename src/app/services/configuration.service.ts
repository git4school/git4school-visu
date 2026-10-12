import { Injectable } from "@angular/core";
import { ConfigurationComponent } from "@components/home/assignment-chooser/configuration/configuration.component";
import { Assignment } from "@models/Assignment.model";
import { CustomModalService } from "@shared/ui/custom-modal/custom-modal.service";

/** Champ de métadonnées à focaliser à l'ouverture de l'éditeur. */
export type ConfigurationFocusField = "title" | "year";

export interface ConfigurationModalOptions {
  /**
   * Champ recevant le focus à l'ouverture (titre par défaut). La duplication demande
   * l'année : c'est le seul champ métier qu'elle ne recopie pas.
   */
  initialFocusField?: ConfigurationFocusField;
}

@Injectable({
  providedIn: "root",
})
export class ConfigurationService {
  constructor(private modalService: CustomModalService) {}

  openConfigurationModal(assignment: Assignment, options?: ConfigurationModalOptions): Promise<any> {
    const customModalRef = this.modalService.open(ConfigurationComponent, {
      size: "lg",
      // Flush pending autosave before dismissing so the caller reloads fresh data (see ADR 0010).
      beforeDismiss: () => Promise.resolve(customModalRef.componentInstance?.flush()).then(() => true),
    });
    customModalRef.componentInstance.assignment = assignment;
    customModalRef.componentInstance.modalRef = customModalRef;
    if (options?.initialFocusField) {
      customModalRef.componentInstance.initialFocusField = options.initialFocusField;
    }
    return customModalRef.result;
  }
}
