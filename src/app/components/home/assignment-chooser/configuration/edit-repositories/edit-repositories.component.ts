import {
  AfterContentChecked,
  ChangeDetectorRef,
  Component,
  OnInit,
  TemplateRef,
  ViewChild,
} from "@angular/core";
import {
  AbstractControl,
  AsyncValidatorFn,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { Error, Repository } from "@models/Repository.model";
import { NgbModal, NgbModalRef } from "@ng-bootstrap/ng-bootstrap";
import { TranslateService } from "@ngx-translate/core";
import { AuthService } from "@services/auth.service";
import { DataService } from "@services/data.service";
import { Observable, of, timer } from "rxjs";
import { catchError, map, switchMap } from "rxjs/operators";
import { BaseTabEditConfigurationComponent } from "../base-tab-edit-configuration.component";
import { ModalAddRepositoriesComponent } from "./modal-add-repositories/modal-add-repositories.component";

/**
 * Corresponds to the sorting mode, respectively, ascending, descending, and no sorting
 */
export type SortDirection = "asc" | "desc" | "";

/**
 * This component lets the user edit the list of repositories of an assignment, manually by entering the URL of the repository,
 * or by selecting it in the list of repositories retrieved from Github
 */
@Component({
  selector: "edit-repositories",
  templateUrl: "./edit-repositories.component.html",
  styleUrls: [
    "../configuration.component.scss",
    "./edit-repositories.component.scss",
  ],
})
export class EditRepositoriesComponent
  extends BaseTabEditConfigurationComponent<Repository>
  implements OnInit, AfterContentChecked {
  /**
   * The template reference corresponding to the confirmation modal when deleting a repository
   */
  @ViewChild("deleteConfirmation")
  private deleteConfirmation: TemplateRef<any>;

  /**
   * The matrix that defines the transition relationships between the sorting modes.
   *
   * See {@link SortDirection}
   */
  private rotateMatrix: { [key: string]: SortDirection } = {
    asc: "desc",
    desc: "asc",
    // desc: "",    // I keep them in case we need it
    // "": "asc",
  };

  /**
   * The reference to the repository deletion modal when it is displayed
   */
  modalRef: NgbModalRef;

  /**
   * The current sorting mode, applied at the moment
   */
  nameDirection: SortDirection;

  /**
   * The {@link Repository} property on which the sorting is applied
   */
  lastPropertySorted: string;

  /**
   * EditRepositoriesComponent constructor
   * @param {FormBuilder} fb The service to build formGroups
   * @param cdref
   * @param {AuthService} authService The service managing authentication
   * @param {NgbModal} modalService The service to open a modal
   * @param {TranslateService} translateService The service for the localization
   * @param {DataService} dataService The service to manage the application data at runtime
   */
  constructor(
    protected fb: FormBuilder,
    protected cdref: ChangeDetectorRef,
    private authService: AuthService,
    private modalService: NgbModal,
    private translateService: TranslateService,
    private dataService: DataService
  ) {
    super(fb, cdref);
  }

  /**
   * When the component is initialized, we sort the repositories by their name in the alphabetical order
   */
  ngOnInit() {
    super.ngOnInit();
    this.nameDirection = "asc";
    this.lastPropertySorted = "name";
    this.sort(this.lastPropertySorted);
  }

  /**
   * @ignore
   */
  ngAfterContentChecked() {
    super.ngAfterContentChecked();
  }

  /**
   * Opens the modal to add one or several repositories from a list retrieved from Github.
   * If the modal is closed with the "Add" button, all the new selected repositories are saved in the assignment
   */
  openAddRepositoriesModal() {
    let modalReference = this.modalService.open(ModalAddRepositoriesComponent, {
      size: "xl",
    });
    modalReference.componentInstance.repoList = this.getFormControls.map(
      (row) => Repository.withJSON(row.value)
    );

    modalReference.result.then(
      (result) => {
        if (result.length > 0) {
          let repoToadd = result.filter(
            (repo1) =>
              !this.getFormControls
                .map((row) => Repository.withJSON(row.value))
                .some((repo2, index, array) => Repository.isEqual(repo1, repo2))
          );
          repoToadd.forEach((repo) => {
            this.addRow(repo);
          });
          this.modify();
          this.submitForm();
        }
      },
      (error) => {}
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
   * @param {Error[]} errors The array of errors
   * @returns A string with the errors translated in the right language
   */
  getErrorTooltip(errors: Error[]): string {
    if (!errors) {
      return "";
    }
    return errors
      .map((err) => this.translateService.instant("ERROR-MESSAGE-" + err.type))
      .join(". ");
  }

  /**
   * Cancel the edition of a row (repository) and set back its value
   * @param {FormGroup} group The formGroup for the repository to cancel the edition
   * @param {number} index The index of the formGroup in the array
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
   * @param {string} property The property to sort the table with
   */
  onSort(property: string) {
    this.lastPropertySorted === property
      ? this.rotate()
      : (this.nameDirection = "asc");

    this.sort(property);
    this.lastPropertySorted = property;
  }

  /**
   * The method called when the "Delete" button is clicked on.
   * If the user has checked "Hide this confirmation box until the next reload",
   * the confirmation modal is not displayed
   * @param {number} index The index of the formGroup to delete
   */
  onDeleteRow(index: number) {
    this.dataService.hideDeleteRepoConfirmation
      ? this.deleteRow(index)
      : this.deleteRowWithDialog(index);
  }

  /**
   * Create the formGroup for a repository
   * @param {Repository} data The repository to create the formGroup for
   * @returns The formGroup
   */
  protected createFormGroup(data?: Repository) {
    return this.fb.group({
      url: [
        data?.url,
        {
          validators: [Validators.required, this.repoAlreadyAddedValidator()],
          asyncValidators: [this.accessToRepoValidator()],
        },
      ],
      name: [data?.name],
      tpGroup: [data?.tpGroup],
      errors: [data ? data.errors : []],
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
        (repo2, index, array) =>
          urlControl.value === repo2.get("url").value &&
          !Object.is(urlControl, repo2.get("url"))
      );
      return urlControl.value && doesRepoAlreadyAdded
        ? { repoAlreadyAdded: true }
        : null;
    };
  }

  /**
   * A validator checking if the authenticated user has access to the specified repository (and if it exists)
   */
  private accessToRepoValidator(): AsyncValidatorFn {
    return (
      urlControl: AbstractControl
    ): Observable<ValidationErrors | null> => {
      if (!urlControl.valueChanges || urlControl.pristine) {
        return of(null);
      } else {
        return timer(1000).pipe(
          switchMap(() => this.authService.verifyUserAccess(urlControl.value)),
          map((res) => null),
          catchError((err) => of({ noAccess: true }))
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
   * @param {string} property The property to sort the table with
   */
  private sort(property: string) {
    if (!this.nameDirection) {
      this.initForm(this.datas);
    } else {
      let sortFactor = this.nameDirection === "asc" ? 1 : -1;
      this.formGroups = [...this.formGroups].sort(
        (a, b) =>
          sortFactor *
          a.get(property).value?.localeCompare(b.get(property).value)
      );
    }
  }

  /**
   * Delete the formGroup at the specified index, after the confirmation of the user.
   * If the user checks "Hide this confirmation box until the next reload",
   * updates the corresponding boolean in the application data
   * @param {number} index The index of the formGroup in the array
   */
  private deleteRowWithDialog(index: number) {
    this.openDeleteConfirmation().then(
      (hide) => {
        this.dataService.hideDeleteRepoConfirmation = hide;
        this.deleteRow(index);
      },
      () => {}
    );
  }

  /**
   * Open the delete confirmation for a repository
   * @returns The result returned by the modal reference
   */
  private openDeleteConfirmation(): Promise<any> {
    this.modalRef = this.modalService.open(this.deleteConfirmation);
    return this.modalRef.result;
  }
}
