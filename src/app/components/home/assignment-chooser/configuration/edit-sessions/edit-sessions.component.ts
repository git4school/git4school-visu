import {
  AfterContentChecked,
  ChangeDetectorRef,
  Component,
  OnInit,
} from "@angular/core";
import {
  FormBuilder,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { Session } from "@models/Session.model";
import {
  NgbDateAdapter,
  NgbDateNativeAdapter,
} from "@ng-bootstrap/ng-bootstrap";
import { Utils } from "@services/utils";
import * as moment from "moment";
import { BaseTabEditConfigurationComponent } from "../base-tab-edit-configuration.component";

@Component({
  selector: "edit-sessions",
  templateUrl: "./edit-sessions.component.html",
  styleUrls: [
    "../configuration.component.scss",
    "./edit-sessions.component.scss",
  ],
  providers: [{ provide: NgbDateAdapter, useClass: NgbDateNativeAdapter }],
})
export class EditSessionsComponent
  extends BaseTabEditConfigurationComponent<Session>
  implements OnInit, AfterContentChecked {
  constructor(protected fb: FormBuilder, protected cdref: ChangeDetectorRef) {
    super(fb, cdref);
  }

  ngOnInit(): void {
    super.ngOnInit();
  }

  ngAfterContentChecked(): void {
    super.ngAfterContentChecked();
  }

  endTimeValidator(): ValidatorFn {
    return (group: FormGroup): ValidationErrors | null => {
      let startTime = group.get("startTime").value;
      let endTime = group.get("endTime").value;

      if (startTime && endTime) {
        if (moment(endTime).isAfter(moment(startTime))) {
          return null;
        }
      }
      return { endTimeBeforeStartTime: true };
    };
  }

  createFormGroup(data?: Session) {
    let formGroup = this.fb.group({
      date: [data ? data.startDate : new Date(), Validators.required],
      startTime: [Utils.getTimeFromDate(data?.startDate), Validators.required],
      endTime: [Utils.getTimeFromDate(data?.endDate), Validators.required],
      tpGroup: [data?.tpGroup],
      isEditable: false,
      isInvalid: false,
      save: {},
    });
    formGroup.setValidators(this.endTimeValidator());
    return formGroup;
  }

  submitForm() {
    this.save(
      this.getFormControls.controls.map((row) => {
        let date = row.get("date").value;
        let startTime = row.get("startTime").value;
        let endTime = row.get("endTime").value;

        let startDate = moment(date).set(startTime).toDate();
        let endDate = moment(date).set(endTime).toDate();
        let tpGroup = row.get("tpGroup").value;
        return new Session(startDate, endDate, tpGroup);
      })
    );
  }

  cancelRow(group: FormGroup, index: number) {
    super.cancelRow(group, index);
    if (!group.get("startTime").value || !group.get("endTime").value) {
      this.deleteRow(index);
    }
  }
}
