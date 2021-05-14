import {
  ChangeDetectionStrategy,
  Component,
  Input,
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
  NgbActiveModal,
  NgbDateAdapter,
  NgbDateNativeAdapter,
} from "@ng-bootstrap/ng-bootstrap";
import { Utils } from "@services/utils";
import * as moment from "moment";

@Component({
  selector: "app-edit-session",
  templateUrl: "./edit-session.component.html",
  styleUrls: ["./edit-session.component.scss"],
  providers: [{ provide: NgbDateAdapter, useClass: NgbDateNativeAdapter }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditSessionComponent implements OnInit {
  @Input() session: Session;
  @Input() addMode: boolean;
  @Input() tpGroups: string[];
  sessionForm: FormGroup;

  constructor(
    public activeModalService: NgbActiveModal,
    public fb: FormBuilder
  ) {}

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

  ngOnInit(): void {
    this.sessionForm = this.fb.group({
      date: [this.session.startDate, Validators.required],
      startTime: [
        Utils.getTimeFromDate(this.session.startDate),
        Validators.required,
      ],
      endTime: [
        Utils.getTimeFromDate(this.session.endDate),
        Validators.required,
      ],
      tpGroup: [this.session.tpGroup || ""],
    });
    this.sessionForm.setValidators(this.endTimeValidator());
    this.sessionForm.get("startTime").valueChanges.subscribe((startTime) => {
      let endTime = { ...startTime };
      endTime.hour += 2;
      this.sessionForm.controls["endTime"].setValue(endTime);
    });
  }

  deleteSession() {
    this.activeModalService.close(null);
  }

  submitSession() {
    let form = this.sessionForm;
    let startDate = moment(form.value.date).set(form.value.startTime).toDate();
    let endDate = moment(form.value.date).set(form.value.endTime).toDate();
    const session = new Session(
      startDate,
      endDate,
      form.value.tpGroup.trim() || ""
    );

    this.activeModalService.close(session);
  }
}
