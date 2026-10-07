import { Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, Optional, ViewChild } from "@angular/core";
import { Assignment } from "@models/Assignment.model";
import { TranslateService } from "@ngx-translate/core";
import { DataService } from "@services/data.service";
import { ToastService } from "@services/toast.service";
import { CustomModalRef } from "@shared/ui/custom-modal/custom-modal-ref";
import { CustomModalService } from "@shared/ui/custom-modal/custom-modal.service";
import { MetadataComponent } from "./metadata/metadata.component";
import { EditRepositoriesComponent } from "./edit-repositories/edit-repositories.component";

/**
 * Delay (ms) applied to free-text fields before persisting, so we don't save on every keystroke.
 */
const TEXT_DEBOUNCE_MS = 600;

/**
 * Duration (ms) the "Saved" indicator stays visible before fading back to idle.
 */
const SAVED_INDICATOR_MS = 1500;

@Component({
  selector: "app-configuration",
  templateUrl: "./configuration.component.html",
  styleUrls: ["./configuration.component.scss"],
})
export class ConfigurationComponent implements OnInit, OnDestroy {
  @Input() assignment: Assignment;
  @Input() modalRef?: any;
  @Output() close = new EventEmitter<Assignment>();
  /**
   * Emitted after the displayed tab changes, so the host (inline editor) can re-fit the card
   * now that its height changed. Irrelevant in a modal, where nobody listens.
   */
  @Output() tabChanged = new EventEmitter<"metadata" | "repositories">();

  @ViewChild("metadataComp") metadataComp: MetadataComponent;
  @ViewChild("reposComp") reposComp: EditRepositoriesComponent;

  activeTab: "metadata" | "repositories" = "metadata";
  reposInitialized = false;

  /**
   * Drives the subtle "Saving / Saved / Title required" indicator in the header.
   */
  saveState: "idle" | "saving" | "saved" | "invalid" = "idle";

  private saveTimeout: any = null;
  private indicatorTimeout: any = null;
  private activeSave: Promise<void> | null = null;
  private rerunSave = false;
  private hasPendingChanges = false;
  private closeHandled = false;
  private destroyed = false;
  private savedId: number | null = null;

  constructor(
    public translateService: TranslateService,
    public dataService: DataService,
    private toastService: ToastService,
    private customModalService: CustomModalService,
    @Optional() public activeModal: CustomModalRef,
  ) {}

  /**
   * In inline mode, Échap closes the editor like the former "Done" button (flush + close).
   * When a modal is open (this component's own modal or any other), dismissal is owned by
   * the modal container; an inner widget that already consumed the key keeps priority.
   */
  @HostListener("document:keydown.escape", ["$event"])
  onEscape(event: KeyboardEvent): void {
    if (this.closeHandled || event.defaultPrevented) {
      return;
    }
    if (this.activeModal || this.modalRef || this.customModalService.hasOpenModals()) {
      return;
    }
    this.closeEditor();
  }

  ngOnInit(): void {
    this.saveState = "idle";
    this.savedId = this.assignment && this.assignment.id !== -1 ? this.assignment.id : null;
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.flushSave();
    if (!this.closeHandled) {
      this.notifyUnsavedOnClose();
    }
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.indicatorTimeout) {
      clearTimeout(this.indicatorTimeout);
      this.indicatorTimeout = null;
    }
  }

  selectTab(tab: "metadata" | "repositories") {
    this.flushSave();
    if (this.activeTab === tab) {
      return;
    }
    this.activeTab = tab;
    if (tab === "repositories") {
      this.reposInitialized = true;
    }
    this.tabChanged.emit(tab);
  }

  /**
   * Debounced persistence for free-text fields.
   */
  onTextModification() {
    this.scheduleSave(TEXT_DEBOUNCE_MS);
  }

  /**
   * Immediate persistence for discrete changes (dates, questions, repositories, ...).
   */
  onImmediateModification() {
    this.scheduleSave(0);
  }

  /**
   * Immediate persistence when a free-text field loses focus, so a loaded field is never left pending.
   */
  onTextBlur() {
    this.flushSave();
  }

  /**
   * Flushes pending changes and leaves the editor (inline chevron / Échap, or modal close button).
   */
  async closeEditor() {
    this.closeHandled = true;
    await this.flushSave();
    this.notifyUnsavedOnClose();
    this.close.emit(this.assignment);
    if (this.modalRef) {
      this.modalRef.close(this.assignment);
    } else if (this.activeModal) {
      this.activeModal.close(this.assignment);
    }
  }

  /**
   * Public entry point used as a dismiss guard so the modal's caller reloads fresh data (see ADR 0010).
   */
  flush(): Promise<void> {
    return this.flushSave();
  }

  private scheduleSave(delay: number) {
    this.hasPendingChanges = true;
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (delay <= 0) {
      this.runSave();
      return;
    }
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.runSave();
    }, delay);
  }

  private flushSave(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    return this.runSave();
  }

  private runSave(): Promise<void> {
    if (this.activeSave) {
      this.rerunSave = true;
      return this.activeSave;
    }
    if (!this.hasPendingChanges) {
      return Promise.resolve();
    }
    this.activeSave = this.persistOnce().then(() => {
      this.activeSave = null;
      if (this.rerunSave) {
        this.rerunSave = false;
        return this.runSave();
      }
    });
    return this.activeSave;
  }

  private persistOnce(): Promise<void> {
    this.metadataComp?.notifySaveAttempt();

    const isNew = this.savedId === null;
    const titleValid = this.isTitleValid;

    if (isNew && !titleValid) {
      // A brand-new assignment cannot be created without a valid title.
      this.saveState = "invalid";
      return Promise.resolve();
    }

    this.applyFormToAssignment();
    this.hasPendingChanges = false;
    this.saveState = titleValid ? "saving" : "invalid";

    this.dataService.repoToLoad = true;
    const toSave = Object.assign(new Assignment(), this.assignment);
    // The in-memory draft keeps its temporary id (-1) so the list view is never recreated mid-edit;
    // the real identifier is tracked separately.
    toSave.id = this.savedId;
    if (isNew) {
      delete toSave.id;
    }

    return this.dataService
      .saveData(toSave)
      .then((id) => {
        this.savedId = id;
        if (titleValid) {
          this.markSaved();
        }
      })
      .catch(() => {
        // Keep the changes pending so a later flush retries, and warn the user.
        this.hasPendingChanges = true;
        this.saveState = "idle";
        this.errorToast("AUTOSAVE.TOAST-SAVE-FAILED");
      });
  }

  /**
   * Copies the current form state into the assignment. The title is only overwritten when valid so an
   * invalid title is never persisted (it keeps its last valid value).
   */
  private applyFormToAssignment() {
    if (this.metadataComp) {
      // getRawValue() reads the controls directly: a child's valueChanges fires before the
      // parent FormGroup recomputes its cached `value`, so `value` would be one change behind
      // for immediate (non-debounced) saves.
      const value = this.metadataComp.metadataForm.getRawValue();
      const metadata = this.assignment.metadata;
      if (this.isTitleValid) {
        metadata.title = value.title;
      }
      metadata.course = value.course;
      metadata.program = value.program;
      metadata.year = value.year;
      metadata.startDate = value.startDate;
      metadata.endDate = value.endDate;
      metadata.questions = value.questions;
      metadata.closingMode = value.closingMode;
      metadata.customClosingKeywords = value.customClosingKeywords;
      metadata.defaultSessionDuration = value.defaultSessionDuration;
    }

    if (this.reposComp) {
      this.assignment.repositories = this.reposComp.committedRepositories;
    }
  }

  private markSaved() {
    if (this.destroyed) {
      return;
    }
    this.saveState = "saved";
    if (this.indicatorTimeout) {
      clearTimeout(this.indicatorTimeout);
    }
    this.indicatorTimeout = setTimeout(() => {
      if (this.saveState === "saved") {
        this.saveState = "idle";
      }
    }, SAVED_INDICATOR_MS);
  }

  /**
   * Emits the most severe close-time toast when some data could not be saved because it was invalid.
   */
  private notifyUnsavedOnClose() {
    if (this.isTitleValid) {
      return;
    }
    if (this.savedId === null) {
      this.errorToast("AUTOSAVE.TOAST-NEW-ASSIGNMENT-NOT-CREATED");
    } else if (this.metadataComp?.titleSaveAttempted) {
      this.errorToast("AUTOSAVE.TOAST-TITLE-NOT-SAVED");
    }
  }

  private errorToast(messageKey: string) {
    this.toastService.error(this.translateService.instant("ERROR"), this.translateService.instant(messageKey));
  }

  private get isTitleValid(): boolean {
    const control = this.metadataComp?.metadataForm?.get("title");
    const value = control ? control.value : this.assignment?.metadata?.title;
    return !!value && String(value).trim().length > 0;
  }
}
