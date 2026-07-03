import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
  ViewChild,
} from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Milestone } from "@models/Milestone.model";
import { NgbTypeahead } from "@ng-bootstrap/ng-bootstrap";
import { CustomModalRef } from "@shared/ui/custom-modal/custom-modal-ref";
import { Utils } from "@services/utils";
import * as moment from "moment";
import { Observable, Subject, merge } from "rxjs";
import { filter, map } from "rxjs/operators";
import { TypePickerOption } from "@shared/ui/type-picker/type-picker.component";

@Component({
  selector: "edit-milestone",
  templateUrl: "./edit-milestone.component.html",
  styleUrls: ["./edit-milestone.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditMilestoneComponent implements OnInit {
  @Input() milestone: Milestone;
  @Input() addMode: boolean;
  @Input() tpGroups: string[];
  @Input() questions: string[];
  @Input() typeaheadSettings;
  @Input() notes: string;
  milestoneForm: FormGroup;

  @ViewChild("instance") instance: NgbTypeahead;
  focus$ = new Subject<string>();
  click$ = new Subject<string>();

  milestoneTypes: TypePickerOption[] = [
    { value: 'corrections', label: 'CORRECTION', color: 'var(--color-danger)' },
    { value: 'reviews', label: 'REVIEW', color: 'var(--color-primary)' },
    { value: 'others', label: 'OTHER', color: 'var(--color-secondary)' }
  ];

  constructor(
    public activeModalService: CustomModalRef,
    public fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  private initForm() {
    this.milestoneForm = this.fb.group({
      date: [this.milestone.date, Validators.required],
      time: [Utils.getTimeFromDate(this.milestone.date), Validators.required],
      label: [this.milestone.label],
      tpGroup: [this.milestone.tpGroup || ""],
      questions: [this.milestone.questions],
      type: [this.milestone.type, Validators.required],
      notes: [this.milestone.notes || ""],
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

  deleteMilestone() {
    this.activeModalService.close(null);
  }

  submitMilestone() {
    let form = this.milestoneForm;
    const milestone = new Milestone(
      moment(form.value.date).set(form.value.time).toDate(),
      form.value.label.trim(),
      form.value.questions,
      form.value.tpGroup.trim() || "",
      form.value.type,
      form.value.notes.trim() || ""
    );
    this.activeModalService.close(milestone);
  }
}
