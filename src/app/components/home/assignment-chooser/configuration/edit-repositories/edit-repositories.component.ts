import {
  AfterContentChecked,
  ChangeDetectorRef,
  Component,
  OnInit,
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
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { TranslateService } from "@ngx-translate/core";
import { AuthService } from "@services/auth.service";
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
  rotateMatrix: { [key: string]: SortDirection } = {
    asc: "desc",
    desc: "",
    "": "asc",
  };

  nameDirection: string;

  constructor(
    protected fb: FormBuilder,
    protected cdref: ChangeDetectorRef,
    private authService: AuthService,
    private modalService: NgbModal,
    private translateService: TranslateService
  ) {
    super(fb, cdref);
  }

  ngOnInit() {
    this.nameDirection = "asc";
    this.sort();
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

  sort() {
    let array;
    if (!this.nameDirection) {
      array = this.datas;
    } else {
      let sortFactor = this.nameDirection === "asc" ? 1 : -1;
      array = [...this.datas].sort(
        (a, b) => sortFactor * a.name.localeCompare(b.name)
      );
    }

    this.initForm(array);
  }

  onSort() {
    this.rotate();
    this.sort();
  }
}
