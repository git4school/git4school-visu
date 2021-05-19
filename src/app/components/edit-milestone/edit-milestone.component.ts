import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
} from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Milestone } from "@models/Milestone.model";
import {
  NgbActiveModal,
  NgbDateAdapter,
  NgbDateNativeAdapter,
} from "@ng-bootstrap/ng-bootstrap";
import { Utils } from "@services/utils";
import * as moment from "moment";

@Component({
  selector: "edit-milestone",
  templateUrl: "./edit-milestone.component.html",
  styleUrls: ["./edit-milestone.component.scss"],
  providers: [{ provide: NgbDateAdapter, useClass: NgbDateNativeAdapter }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditMilestoneComponent implements OnInit {
  @Input() milestone: Milestone;
  @Input() addMode: boolean;
  @Input() tpGroups: string[];
  @Input() questions: string[];
  @Input() typeaheadSettings;
  milestoneForm: FormGroup;

  constructor(
    public activeModalService: NgbActiveModal,
    public fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.milestoneForm = this.fb.group({
      date: [this.milestone.date, Validators.required],
      time: [Utils.getTimeFromDate(this.milestone.date), Validators.required],
      label: [this.milestone.label],
      tpGroup: [this.milestone.tpGroup || ""],
      questions: [this.milestone.questions],
      type: [this.milestone.type, Validators.required],
    });
  }

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
      form.value.type
    );
    this.activeModalService.close(milestone);
  }
}
