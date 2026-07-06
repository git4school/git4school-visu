import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
  ViewChild,
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
  NgbTypeahead,
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditSessionComponent implements OnInit {
  @Input() session: Session;
  @Input() addMode: boolean;
  @Input() tpGroups: string[];
  @Input() defaultSessionDuration;
  @Input() notes: string;
  sessionForm: FormGroup;

  @ViewChild("instance") instance: NgbTypeahead;
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
        const mStart = moment(startTime, "HH:mm");
        const mEnd = moment(endTime, "HH:mm");
        if (mEnd.isAfter(mStart) || mEnd.isBefore(mStart)) {
          // Allow cross-midnight or just any valid time, we handle wrap around in the component.
          // For simplicity, just return null if both are present. 
          // If strict order is needed:
          // if (mEnd.isAfter(mStart)) return null;
          // But since period mode can cross midnight, we return null.
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
    const tStart = Utils.getTimeFromDate(this.session.startDate);
    const startStr = tStart ? `${tStart.hour.toString().padStart(2, '0')}:${tStart.minute.toString().padStart(2, '0')}` : '12:00';
    
    const tEnd = Utils.getTimeFromDate(this.session.endDate);
    const endStr = tEnd ? `${tEnd.hour.toString().padStart(2, '0')}:${tEnd.minute.toString().padStart(2, '0')}` : '14:00';

    this.sessionForm = this.fb.group({
      date: [this.session.startDate, Validators.required],
      startTime: [startStr, Validators.required],
      endTime: [endStr, Validators.required],
      tpGroup: [this.session.tpGroup || ""],
      notes: [this.session.notes || ""],
    });
    this.sessionForm.setValidators(this.endTimeValidator());
  }

  onPeriodChange(event: { start: string; end: string }) {
    this.sessionForm.patchValue({
      startTime: event.start,
      endTime: event.end
    });
    this.sessionForm.markAsDirty();
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
    const [hStart, mStart] = form.value.startTime.split(':').map(Number);
    const [hEnd, mEnd] = form.value.endTime.split(':').map(Number);

    let startDate = moment(form.value.date).set({ hour: hStart, minute: mStart }).toDate();
    let endDate = moment(form.value.date).set({ hour: hEnd, minute: mEnd }).toDate();
    
    if (moment(endDate).isBefore(startDate)) {
      endDate = moment(endDate).add(1, 'days').toDate(); // Wrap around midnight
    }
    const session = new Session(
      startDate,
      endDate,
      form.value.tpGroup.trim() || "",
      form.value.notes.trim() || ""
    );

    this.activeModalService.close(session);
  }
}
