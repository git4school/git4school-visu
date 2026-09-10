import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
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
import { CustomModalRef } from "@shared/ui/custom-modal/custom-modal-ref";
import { DataService } from "@services/data.service";
import { Utils } from "@services/utils";
import { TranslateService } from "@ngx-translate/core";
import * as moment from "moment";
import { Observable, Subject, merge } from "rxjs";
import { takeUntil } from "rxjs/operators";

@Component({
  selector: "app-edit-session",
  templateUrl: "./edit-session.component.html",
  styleUrls: ["./edit-session.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditSessionComponent implements OnInit, OnDestroy {
  @Input() session: Session;
  @Input() addMode: boolean;
  @Input() tpGroups: string[];
  @Input() defaultSessionDuration;
  @Input() notes: string;
  sessionForm: FormGroup;
  defaultLabel: string = "";
  private destroy$ = new Subject<void>();

  get resolvedTpGroups(): string[] {
    return this.tpGroups?.length ? this.tpGroups : (this.dataService?.tpGroups || []);
  }

  notesOpen: boolean = false;

  constructor(
    public activeModalService: CustomModalRef,
    public fb: FormBuilder,
    private dataService: DataService,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef
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
    this.computeDefaultLabel();
    this.initForm();

    this.translateService.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.computeDefaultLabel();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  computeDefaultLabel() {
    const group = this.session?.tpGroup || "";
    const sessions = this.dataService?.sessions || [];
    const sameGroup = sessions
      .filter((s) => (s.tpGroup || "") === group && s !== this.session)
      .slice()
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    
    const curTime = this.session?.startDate ? new Date(this.session.startDate).getTime() : 0;
    let idx = sameGroup.findIndex((s) => new Date(s.startDate).getTime() > curTime);
    let sessionNumber = idx === -1 ? sameGroup.length + 1 : idx + 1;

    const defaultName = this.translateService.instant("DEFAULT-SESSION-NAME", {
      number: sessionNumber,
    });
    if (defaultName && defaultName !== "DEFAULT-SESSION-NAME") {
      this.defaultLabel = defaultName;
    } else {
      const sessionPrefix = this.translateService.instant("SESSION") || "Séance";
      this.defaultLabel = `${sessionPrefix} ${sessionNumber}`;
    }
    this.cdr.markForCheck();
  }

  private initForm() {
    const tStart = Utils.getTimeFromDate(this.session.startDate);
    const startStr = tStart ? `${tStart.hour.toString().padStart(2, '0')}:${tStart.minute.toString().padStart(2, '0')}` : '12:00';
    
    const tEnd = Utils.getTimeFromDate(this.session.endDate);
    const endStr = tEnd ? `${tEnd.hour.toString().padStart(2, '0')}:${tEnd.minute.toString().padStart(2, '0')}` : '14:00';

    this.sessionForm = this.fb.group({
      label: [this.session.label || ""],
      date: [this.session.startDate, Validators.required],
      startTime: [startStr, Validators.required],
      endTime: [endStr, Validators.required],
      tpGroup: [this.session.tpGroup || ""],
      notes: [this.session.notes || ""],
    });
    this.sessionForm.setValidators(this.endTimeValidator());
    
    // Recompute default placeholder if TP group changes
    this.sessionForm.get('tpGroup')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.computeDefaultLabel();
      });

    // Open the notes section if there's already text in it
    if (this.session.notes && this.session.notes.trim().length > 0) {
      this.notesOpen = true;
    }
  }

  onPeriodChange(event: { start: string; end: string }) {
    this.sessionForm.patchValue({
      startTime: event.start,
      endTime: event.end
    });
    this.sessionForm.markAsDirty();
  }

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
      form.value.tpGroup ? form.value.tpGroup.trim() : "",
      form.value.notes ? form.value.notes.trim() : "",
      form.value.label ? form.value.label.trim() : ""
    );

    this.activeModalService.close(session);
  }
}
