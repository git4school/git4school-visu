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

export type SortDirection = "asc" | "desc" | "";

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
  @ViewChild("deleteConfirmation")
  private deleteConfirmation: TemplateRef<any>;
  modalRef: NgbModalRef;

  rotateMatrix: { [key: string]: SortDirection } = {
    asc: "desc",
    desc: "asc",
    // desc: "",    // I keep them in case we need it
    // "": "asc",
  };

  nameDirection: string;

  lastPropertySorted: string;

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

  ngOnInit() {
    super.ngOnInit();
    this.nameDirection = "asc";
    this.lastPropertySorted = "name";
    this.sort(this.lastPropertySorted);
  }

  ngAfterContentChecked() {
    super.ngAfterContentChecked();
  }

  repoAlreadyAddedValidator(): ValidatorFn {
    return (urlControl: AbstractControl): ValidationErrors | null => {
      let doesRepoAlreadyAdded = this.datas.some((repo2, index, array) =>
        Repository.isEqual(new Repository(urlControl.value), repo2)
      );
      return urlControl.value && doesRepoAlreadyAdded
        ? { repoAlreadyAdded: true }
        : null;
    };
  }

  accessToRepoValidator(): AsyncValidatorFn {
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

  createFormGroup(data?: Repository) {
    return this.fb.group({
      url: [
        data?.url,
        {
          validators: [Validators.required],
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

  submitForm() {
    const controls = this.getFormControls;
    this.save(controls.map((row) => Repository.withJSON(row.value)));
  }

  getErrorTooltip(errors: Error[]): string {
    if (!errors) {
      return "";
    }
    return errors
      .map((err) => this.translateService.instant("ERROR-MESSAGE-" + err.type))
      .join(". ");
  }

  cancelRow(group: FormGroup, index: number) {
    super.cancelRow(group, index);
    if (!group.get("url").value) {
      this.deleteRow(index);
    }
  }

  rotate() {
    this.nameDirection = this.rotateMatrix[this.nameDirection];
  }

  sort(property: string) {
    if (!this.nameDirection) {
      this.initForm(this.datas);
    } else {
      let sortFactor = this.nameDirection === "asc" ? 1 : -1;
      this.formGroups = [...this.formGroups].sort(
        (a, b) =>
          sortFactor *
          a.get(property)?.value.localeCompare(b.get(property)?.value)
      );
    }
  }

  onSort(property: string) {
    this.lastPropertySorted == property
      ? this.rotate()
      : (this.nameDirection = "asc");

    this.sort(property);
    this.lastPropertySorted = property;
  }

  onDeleteRow(index: number) {
    this.dataService.hideDeleteRepoConfirmation
      ? this.deleteRow(index)
      : this.deleteRowWithDialog(index);
  }

  deleteRowWithDialog(index: number) {
    this.openDeleteConfirmation().then(
      (hide) => {
        this.dataService.hideDeleteRepoConfirmation = hide;
        this.deleteRow(index);
      },
      () => {}
    );
  }

  private openDeleteConfirmation(): Promise<any> {
    this.modalRef = this.modalService.open(this.deleteConfirmation);
    return this.modalRef.result;
  }
}
