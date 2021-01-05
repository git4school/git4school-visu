import {
  AfterContentChecked,
  ChangeDetectorRef,
  Component,
  OnInit
} from "@angular/core";
import {
  AbstractControl,
  AsyncValidatorFn,
  FormBuilder,
  ValidationErrors,
  ValidatorFn,
  Validators
} from "@angular/forms";
import { Error, Repository } from "@models/Repository.model";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { TranslateService } from "@ngx-translate/core";
import { AuthService } from "@services/auth.service";
import { DataService } from "@services/data.service";
import { Observable, of, timer } from "rxjs";
import { catchError, map, switchMap } from "rxjs/operators";
import { BaseTabEditConfigurationComponent } from "../base-tab-edit-configuration.component";
import { ModalAddRepositoriesComponent } from "./modal-add-repositories/modal-add-repositories.component";

@Component({
  selector: "edit-repositories",
  templateUrl: "./edit-repositories.component.html",
  styleUrls: ["./edit-repositories.component.scss"],
})
export class EditRepositoriesComponent
  extends BaseTabEditConfigurationComponent<Repository>
  implements OnInit, AfterContentChecked {
  constructor(
    protected fb: FormBuilder,
    protected cdref: ChangeDetectorRef,
    private authService: AuthService,
    private modalService: NgbModal,
    private dataService: DataService,
    private translateService: TranslateService
  ) {
    super(fb, cdref);
  }

  ngOnInit() {
    super.ngOnInit();
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
    modalReference.componentInstance.repoList = this.getFormControls.controls.map(
      (row) => Repository.withJSON(row.value)
    );

    modalReference.result.then(
      (result) => {
        if (result.length > 0) {
          let repoToadd = result.filter(
            (repo1) =>
              !this.getFormControls.controls
                .map((row) => Repository.withJSON(row.value))
                .some((repo2, index, array) => Repository.isEqual(repo1, repo2))
          );
          repoToadd.forEach((repo) => {
            this.addRow(repo);
          });
          this.modify();
        }
      },
      (error) => {}
    );
  }

  submitForm() {
    const formArray = this.getFormControls;
    this.save.emit(
      formArray.controls.map((row) => Repository.withJSON(row.value))
    );
  }

  getErrorTooltip(errors: Error[]): string {
    if (!errors) {
      return "";
    }
    return errors
      .map((err) => this.translateService.instant("ERROR-MESSAGE-" + err.type))
      .join(". ");
  }
}
