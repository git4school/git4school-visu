import { AfterContentChecked, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AbstractControl, AsyncValidatorFn, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { Repository } from '@models/Repository.model';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from '@services/auth.service';
import { DataService } from '@services/data.service';
import { Observable, of, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { BaseTabEditConfigurationComponent } from '../base-tab-edit-configuration.component';
import { ModalAddRepositoriesComponent } from './modal-add-repositories/modal-add-repositories.component';

@Component({
  selector: 'edit-repositories',
  templateUrl: './edit-repositories.component.html',
  styleUrls: ['./edit-repositories.component.scss']
})
export class EditRepositoriesComponent extends BaseTabEditConfigurationComponent<Repository> implements OnInit, AfterContentChecked {


  constructor(
    protected fb: FormBuilder,
    protected cdref: ChangeDetectorRef,
    private authService: AuthService,
    private modalService: NgbModal,
    private dataService: DataService
  ) { super(fb, cdref); }

  ngOnInit() {
    super.ngOnInit();
  }

  ngAfterContentChecked() {
    super.ngAfterContentChecked();
  }

  accessToRepoValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.valueChanges || control.pristine) {
        return of(null);
      } else {
        return timer(1000).pipe(
          switchMap(() => this.authService.verifyUserAccess(control.value)),
          map(res => null),
          catchError(err => of({ 'noAccess': true }))
        );
      }
    };
  }

  createFormGroup(data?: Repository) {
    return this.fb.group({
      url: [data ? data.url : '',
      {
        validators: [Validators.required],
        asyncValidators: [this.accessToRepoValidator()],
      }],
      name: [data ? data.name : ''],
      tpGroup: [data ? data.tpGroup : ''],
      isEditable: false,
      isInvalid: false,
      save: {}
    });
  }

  openAddRepositoriesModal() {
    this.modalService.open(ModalAddRepositoriesComponent, { size: 'xl' }).result.then(result => {
      if (result.length > 0) {
        let repoToadd = result.filter(repo1 =>
          !this.getFormControls.controls.map(row => Repository.withJSON(row.value)).some((repo2, index, array) =>
            Repository.isEqual(repo1, repo2)
          )
        );
        repoToadd.forEach(repo => {
          this.addRow(repo);
        });
        this.modify();
      }
    }
    );
  }

  submitForm() {
    const control = this.getFormControls;
    this.save.emit(control.controls.map(row => Repository.withJSON(row.value)));
  }
}
