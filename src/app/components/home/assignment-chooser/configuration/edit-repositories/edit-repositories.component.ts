import { ChangeDetectorRef, Component, Input, OnInit, TemplateRef, ViewChild } from "@angular/core";
import { AbstractControl, AsyncValidatorFn, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators } from "@angular/forms";
import { Error, Repository } from "@models/Repository.model";
import { Assignment } from "@models/Assignment.model";
import { GitProviderType } from "@models/Account.model";
import { TranslateService } from "@ngx-translate/core";
import { CustomModalService } from "@shared/ui/custom-modal/custom-modal.service";
import { CustomModalRef } from "@shared/ui/custom-modal/custom-modal-ref";
import { ToastService } from "@services/toast.service";
import { AccountsService } from "@services/accounts.service";
import { GithubAuthService } from "@services/github-auth.service";
import { DataService } from "@services/data.service";
import { CommitsService } from "@services/commits.service";
import { Utils } from "@services/utils";
import { Observable, of, timer } from "rxjs";
import { catchError, map, switchMap, take } from "rxjs/operators";
import { BaseTabEditConfigurationComponent } from "../base-tab-edit-configuration.component";
import { ModalAddRepositoriesComponent } from "./modal-add-repositories/modal-add-repositories.component";

/**
 * Corresponds to the sorting mode, respectively, ascending, descending, and no sorting
 */
export type SortDirection = "asc" | "desc" | "";

/**
 * This component lets the user edit the list of repositories of an assignment, manually by entering the URL of the repository,
 * or by selecting it in the list of repositories retrieved from Github or GitLab
 */
@Component({
  selector: "edit-repositories",
  templateUrl: "./edit-repositories.component.html",
  styleUrls: ["../configuration.component.scss", "./edit-repositories.component.scss"],
})
export class EditRepositoriesComponent extends BaseTabEditConfigurationComponent<Repository> implements OnInit {
  @Input() assignment?: Assignment;

  nameDirection: SortDirection;
  lastPropertySorted: string;
  searchQuery = "";
  selectionMode = false;
  selectedRepositories: Set<number> = new Set();
  hoveredRepository: number | null = null;

  isRefreshingNames = false;
  isConfirmingRefresh = false;
  animatingRepoUrls: Set<string> = new Set();
  private confirmTimer: any = null;

  get provider(): GitProviderType {
    return this.assignment?.provider || "github";
  }

  get isConnectedToProvider(): boolean {
    return this.accountsService.hasAccount(this.provider);
  }

  private rotateMatrix: { [key: string]: SortDirection } = {
    asc: "desc",
    desc: "asc",
  };

  constructor(
    protected fb: FormBuilder,
    protected cdref: ChangeDetectorRef,
    public accountsService: AccountsService,
    public githubAuthService: GithubAuthService,
    private modalService: CustomModalService,
    private translateService: TranslateService,
    private toastService: ToastService,
    private dataService: DataService,
    private commitsService: CommitsService,
  ) {
    super(fb, cdref);
  }

  get filteredFormControls() {
    if (!this.searchQuery) return this.getFormControls;
    const lowerQuery = this.searchQuery.toLowerCase();
    return this.getFormControls.filter((group) => {
      const name = group.get("name")?.value?.toLowerCase() || "";
      const url = group.get("url")?.value?.toLowerCase() || "";
      const tpGroup = group.get("tpGroup")?.value?.toLowerCase() || "";
      return name.includes(lowerQuery) || url.includes(lowerQuery) || tpGroup.includes(lowerQuery);
    });
  }

  get existingTpGroups(): string[] {
    const groups = this.getFormControls.map((group) => group.get("tpGroup")?.value).filter((val) => val && val.trim() !== "");
    return Array.from(new Set(groups)).sort();
  }

  toggleSelection(index: number) {
    if (this.selectedRepositories.has(index)) {
      this.selectedRepositories.delete(index);
    } else {
      this.selectedRepositories.add(index);
    }
    this.selectionMode = this.selectedRepositories.size > 0;
  }

  isSelected(index: number): boolean {
    return this.selectedRepositories.has(index);
  }

  isAllSelected(): boolean {
    const visibleIds = this.filteredFormControls.map((group) => this.getFormControls.indexOf(group));
    if (visibleIds.length === 0) return false;
    return visibleIds.every((id) => this.selectedRepositories.has(id));
  }

  toggleSelectAll() {
    const visibleIds = this.filteredFormControls.map((group) => this.getFormControls.indexOf(group));
    if (this.isAllSelected()) {
      visibleIds.forEach((id) => this.selectedRepositories.delete(id));
    } else {
      visibleIds.forEach((id) => this.selectedRepositories.add(id));
    }
    this.selectionMode = this.selectedRepositories.size > 0;
  }

  cancelSelection() {
    this.selectedRepositories.clear();
    this.selectionMode = false;
  }

  deleteSelected() {
    if (this.selectedRepositories.size === 0) return;
    const indicesToDelete = Array.from(this.selectedRepositories).sort((a, b) => b - a);

    indicesToDelete.forEach((index) => this.deleteRow(index));
    this.cancelSelection();
  }

  ngOnInit() {
    super.ngOnInit();
    this.nameDirection = "asc";
    this.lastPropertySorted = "name";
    this.sort(this.lastPropertySorted);
  }

  onRefreshNamesClick() {
    if (this.isRefreshingNames) return;
    if (!this.isConfirmingRefresh) {
      this.isConfirmingRefresh = true;
      if (this.confirmTimer) {
        clearTimeout(this.confirmTimer);
      }
      this.confirmTimer = setTimeout(() => {
        this.isConfirmingRefresh = false;
        this.cdref.markForCheck();
      }, 4000);
      return;
    }

    this.executeRefreshNames();
  }

  cancelConfirmRefresh(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.isConfirmingRefresh = false;
    if (this.confirmTimer) {
      clearTimeout(this.confirmTimer);
      this.confirmTimer = null;
    }
  }

  executeRefreshNames() {
    this.isConfirmingRefresh = false;
    if (this.confirmTimer) {
      clearTimeout(this.confirmTimer);
      this.confirmTimer = null;
    }

    const repos = this.getFormControls.map((row) => Repository.withJSON(row.value));
    if (repos.length === 0) return;

    this.isRefreshingNames = true;
    this.commitsService
      .fetchRepositoriesMetadata(repos)
      .pipe(take(1))
      .subscribe(
        (metadataList) => {
          this.isRefreshingNames = false;
          if (!metadataList || metadataList.length === 0) {
            this.toastService.warning(
              this.translateService.instant("EDIT-REPOSITORIES.HEADER"),
              this.translateService.instant("EDIT-REPOSITORIES.NAMES-REFRESH-NONE"),
            );
            this.cdref.markForCheck();
            return;
          }

          const metaMap = new Map<string, { name: string; tpGroup: string }>();
          metadataList.forEach((m) => {
            if (m.url) {
              metaMap.set(m.url.toLowerCase(), m);
            }
          });

          let updatedCount = 0;
          const changedControls: Array<{ control: FormGroup; newName: string; newGroup: string; url: string }> = [];

          this.getFormControls.forEach((group) => {
            const url = group.get("url")?.value;
            if (!url) return;
            const meta = metaMap.get(url.toLowerCase());
            if (!meta) return;

            const currentName = group.get("name")?.value || "";
            const currentGroup = group.get("tpGroup")?.value || "";
            const targetName = meta.name || "";
            const targetGroup = meta.tpGroup || "";

            const hasNameChange = targetName && targetName !== currentName;
            const hasGroupChange = targetGroup && targetGroup !== currentGroup;

            if (hasNameChange || hasGroupChange) {
              updatedCount++;
              changedControls.push({
                control: group,
                newName: targetName || currentName,
                newGroup: targetGroup || currentGroup,
                url,
              });
            }
          });

          if (updatedCount === 0) {
            this.toastService.warning(
              this.translateService.instant("EDIT-REPOSITORIES.HEADER"),
              this.translateService.instant("EDIT-REPOSITORIES.NAMES-REFRESH-NONE"),
            );
            this.cdref.markForCheck();
            return;
          }

          changedControls.forEach((item, index) => {
            const staggerDelay = index * 45;
            setTimeout(() => {
              this.animatingRepoUrls.add(item.url);
              this.cdref.markForCheck();

              setTimeout(() => {
                item.control.get("name")?.setValue(item.newName);
                if (item.newGroup) {
                  item.control.get("tpGroup")?.setValue(item.newGroup);
                }
                this.cdref.markForCheck();
              }, 120);

              setTimeout(() => {
                this.animatingRepoUrls.delete(item.url);
                this.cdref.markForCheck();
              }, 450);
            }, staggerDelay);
          });

          this.modify();
          this.submitForm();
          this.toastService.success(
            this.translateService.instant("SUCCESS"),
            this.translateService.instant("EDIT-REPOSITORIES.NAMES-REFRESH-SUCCESS"),
          );
        },
        (err) => {
          this.isRefreshingNames = false;
          console.error("Error refreshing repository names", err);
          this.toastService.error(this.translateService.instant("ERROR"), this.translateService.instant("ERROR-MESSAGE-NO-ACCESS"));
          this.cdref.markForCheck();
        },
      );
  }

  /**
   * TrackBy function for *ngFor performance
   */
  trackByRepo(index: number, group: FormGroup): any {
    return group.get("url")?.value || index;
  }

  /**
   * Opens the modal to add one or several repositories from a list retrieved from Github or GitLab.
   * If the modal is closed with the "Add" button, all the new selected repositories are saved in the assignment
   */
  openAddRepositoriesModal() {
    let modalReference: CustomModalRef = this.modalService.open(ModalAddRepositoriesComponent, { size: "lg" });
    modalReference.componentInstance.repoList = this.getFormControls.map((row) => Repository.withJSON(row.value));
    modalReference.componentInstance.provider = this.provider;

    modalReference.result.then(
      (result) => {
        if (result.length > 0) {
          let repoToadd = result.filter(
            (repo1) =>
              !this.getFormControls
                .map((row) => Repository.withJSON(row.value))
                .some((repo2, index, array) => Repository.isEqual(repo1, repo2)),
          );
          repoToadd.forEach((repo) => {
            repo.provider = this.provider;
            this.addRow(repo);
          });
          this.modify();
        }
      },
      (error) => {},
    );
  }

  /**
   * Get the formControls (all the repositories in the list) and save them in the assignment
   */
  submitForm() {
    const controls = this.getFormControls;
    this.save(controls.map((row) => Repository.withJSON(row.value)));
  }

  /**
   * Get the string to display in the error tooltip, translated in the right language
   * @param errors The array of errors
   * @returns A string with the errors translated in the right language
   */
  getErrorTooltip(errors: Error[]): string {
    if (!errors) {
      return "";
    }
    return errors.map((err) => this.translateService.instant("ERROR-MESSAGE-" + err.type)).join(". ");
  }

  /**
   * Cancel the edition of a row (repository) and set back its value
   * @param group The formGroup for the repository to cancel the edition
   * @param index The index of the formGroup in the array
   */
  cancelRow(group: FormGroup, index: number) {
    super.cancelRow(group, index);
    if (!group.get("url").value) {
      this.removeRow(index);
    }
  }

  /**
   * The method called when a header is clicked on to sort the table by the clicked property.
   *
   * See {@link sort}
   * @param property The property to sort the table with
   */
  onSort(property: string) {
    this.lastPropertySorted === property ? this.rotate() : (this.nameDirection = "asc");

    this.sort(property);
    this.lastPropertySorted = property;
  }

  /**
   * The method called when the "Delete" button is clicked on.
   * If the user has checked "Hide this confirmation box until the next reload",
   * the confirmation modal is not displayed
   * @param index The index of the formGroup to delete
   */
  onDeleteRow(index: number) {
    this.deleteRow(index);
  }

  /**
   * Create the formGroup for a repository
   * @param data The repository to create the formGroup for
   * @returns The formGroup
   */
  protected createFormGroup(data?: Repository) {
    let avatarUrl = null;
    if (data?.url) {
      try {
        const parts = data.url.split("/");
        if (parts.length >= 4 && parts[2].includes("github.com")) {
          avatarUrl = "https://github.com/" + parts[3] + ".png";
        }
      } catch (e) {}
    }

    return this.fb.group({
      url: [
        data?.url,
        {
          validators: [Validators.required, this.repoAlreadyAddedValidator()],
          asyncValidators: [this.accessToRepoValidator(data?.url)],
        },
      ],
      name: [data?.name],
      tpGroup: [data?.tpGroup],
      errors: [data ? data.errors : []],
      avatarUrl: [avatarUrl],
      provider: [data?.provider || this.provider],
      isEditable: false,
      isInvalid: false,
      save: {},
    });
  }

  /**
   * A validator checking that there are not 2 identical repositories to validate the row
   */
  private repoAlreadyAddedValidator(): ValidatorFn {
    return (urlControl: AbstractControl): ValidationErrors | null => {
      let doesRepoAlreadyAdded = this.getFormControls.some(
        (repo2, index, array) => urlControl.value === repo2.get("url").value && !Object.is(urlControl, repo2.get("url")),
      );
      return urlControl.value && doesRepoAlreadyAdded ? { repoAlreadyAdded: true } : null;
    };
  }

  /**
   * A validator checking if the authenticated user has access to the specified repository (and if it exists)
   */
  private accessToRepoValidator(initialUrl?: string): AsyncValidatorFn {
    return (urlControl: AbstractControl): Observable<ValidationErrors | null> => {
      if (!urlControl.value || urlControl.value === initialUrl) {
        return timer(10).pipe(
          map(() => null),
          take(1),
        );
      } else {
        return timer(1000).pipe(
          switchMap(() => this.accountsService.getDataService(this.provider).verifyUserAccess(urlControl.value)),
          map((res) => {
            if (urlControl.parent && urlControl.parent.get("avatarUrl")) {
              const avatar = res?.avatar_url || res?.owner?.avatar_url || null;
              urlControl.parent.get("avatarUrl").setValue(avatar, { emitEvent: false });
            }
            return null;
          }),
          catchError((err) => {
            if (urlControl.parent && urlControl.parent.get("avatarUrl")) {
              urlControl.parent.get("avatarUrl").setValue(null, { emitEvent: false });
            }
            const title = this.translateService.instant("ERROR");
            const msg = this.translateService.instant("ERROR-MESSAGE-NO-ACCESS");
            this.toastService.error(title, msg);
            return of({ noAccess: true });
          }),
          take(1),
        );
      }
    };
  }

  /**
   * Change the sorting mode according to the current sorting mode and the {@link rotateMatrix}
   */
  private rotate() {
    this.nameDirection = this.rotateMatrix[this.nameDirection];
  }

  /**
   * Sort the table, the repositories array, by the chosen property.
   * The sorting used is an alphabetical sorting as all the properties of a repository are a string
   * @param property The property to sort the table with
   */
  private sort(property: string) {
    if (!this.nameDirection) {
      this.initForm(this.datas);
    } else {
      let sortFactor = this.nameDirection === "asc" ? 1 : -1;
      this.formGroups = [...this.formGroups].sort((a, b) => sortFactor * a.get(property).value?.localeCompare(b.get(property).value));
    }
  }
}
