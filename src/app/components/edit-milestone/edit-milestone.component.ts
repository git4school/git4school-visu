import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
  ViewChild,
} from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Milestone } from "@models/Milestone.model";
import { Observable, Subject, merge } from "rxjs";
import { CustomModalRef } from "@shared/ui/custom-modal/custom-modal-ref";
import * as moment from "moment";
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

  notesOpen = false;

  private initForm() {
    this.milestoneForm = this.fb.group({
      date: [this.milestone.date, Validators.required],
      label: [this.milestone.label],
      tpGroup: [this.milestone.tpGroup || ""],
      questions: [this.milestone.questions],
      type: [this.milestone.type, Validators.required],
      notes: [this.milestone.notes || ""],
    });
    
    // Open the notes section if there's already text in it
    if (this.milestone.notes && this.milestone.notes.trim().length > 0) {
      this.notesOpen = true;
    }
  }


  deleteMilestone() {
    this.activeModalService.close(null);
  }

  submitMilestone() {
    let form = this.milestoneForm;
    const date = moment(form.value.date).toDate();
    const milestone = new Milestone(
      date,
      form.value.label.trim(),
      form.value.questions,
      form.value.tpGroup.trim() || "",
      form.value.type,
      form.value.notes.trim() || ""
    );
    this.activeModalService.close(milestone);
  }
}
