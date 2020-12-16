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
import * as moment from "moment";
import { BaseTabEditConfigurationComponent } from "../base-tab-edit-configuration.component";

@Component({
  selector: "edit-sessions",
  templateUrl: "./edit-sessions.component.html",
  styleUrls: ["./edit-sessions.component.scss"],
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
      startTime: [
        data ? this.getTimeFromDate(data.startDate) : null,
        Validators.required,
      ],
      endTime: [
        data ? this.getTimeFromDate(data.endDate) : null,
        Validators.required,
      ],
      tpGroup: [data ? data.tpGroup : ""],
      isEditable: false,
      isInvalid: false,
      save: {},
    });
    formGroup.setValidators(this.endTimeValidator());
    return formGroup;
  }

  private getTimeFromDate(date: Date) {
    return {
      hour: moment(date).hour(),
      minute: moment(date).minutes(),
    };
  }

  submitForm() {
    this.save.emit(
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
}
