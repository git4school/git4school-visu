import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
  ViewChild
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
  NgbTypeahead
} from "@ng-bootstrap/ng-bootstrap";
import { CustomModalRef } from "@shared/ui/custom-modal/custom-modal-ref";
import { Utils } from "@services/utils";
import * as moment from "moment";
import { Observable, Subject, merge } from "rxjs";
import { filter, map } from "rxjs/operators";

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
  @Input() defaultSessionDuration;
  @Input() notes: string;
  sessionForm: FormGroup;

  @ViewChild('instance') instance: NgbTypeahead;
  focus$ = new Subject<string>();
  click$ = new Subject<string>();

  constructor(
    public activeModalService: CustomModalRef,
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
    this.initForm();
  }

  private initForm() {
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
      notes: [this.session.notes || ""],
    });
    this.sessionForm.setValidators(this.endTimeValidator());
    this.sessionForm.get("startTime").valueChanges.subscribe((startTime) => {
      let endTime = Utils.addTimeToTime(startTime, this.defaultSessionDuration);
      this.sessionForm.controls["endTime"].setValue(endTime);
    });
  }

  searchGroup = (text$: Observable<string>) => {
    const clicksWithClosedPopup$ = this.click$.pipe(
      filter(() => !this.instance.isPopupOpen())
    );
    const inputFocus$ = this.focus$;
    return merge(text$, clicksWithClosedPopup$, inputFocus$).pipe(
      map((search) =>
        (this.tpGroups || [])
          .filter(
            (group) =>
              group.toLowerCase().indexOf((search || "").toLowerCase()) > -1
          )
          .slice(0, 10)
      )
    );
  };

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
      form.value.tpGroup.trim() || "",
      form.value.notes.trim() || ""
    );

    this.activeModalService.close(session);
  }
}
