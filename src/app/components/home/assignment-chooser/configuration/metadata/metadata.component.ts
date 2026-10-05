import { Component, Input, OnDestroy, OnInit, ViewChild, AfterViewInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Metadata } from "@models/Metadata.model";
import { NgbDateAdapter } from "@ng-bootstrap/ng-bootstrap";
import { NgbDateNativeUTCFranceAdapter } from "@services/ngb-date-native-utcfrance-adapter.service";
import * as moment from "moment";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { BaseEditConfigurationComponent } from "../base-edit-configuration.component";
import { TextInputComponent } from "@shared/ui/text-input/text-input.component";
import { QuestionsChooserComponent } from "@components/questions-chooser/questions-chooser.component";

/**
 * This component lets you modify metadata such as document title, course, year, start date and end date, questions
 */
@Component({
  selector: "metadata",
  templateUrl: "./metadata.component.html",
  styleUrls: ["../configuration.component.scss", "./metadata.component.scss"],
  providers: [{ provide: NgbDateAdapter, useClass: NgbDateNativeUTCFranceAdapter }],
})
export class MetadataComponent extends BaseEditConfigurationComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() metadata: Metadata;
  @ViewChild("titleInput") titleInput: TextInputComponent;
  @ViewChild("questionsChooser") questionsChooser: QuestionsChooserComponent;
  public metadataForm: FormGroup;

  /**
   * Set to true on the first save attempt so the required-title feedback only appears once a save was tried.
   */
  titleSaveAttempted = false;

  /**
   * Settings for the typeahead text input
   */
  readonly typeaheadSettings = {
    tagClass: "badge badge-pill badge-secondary mr-1",
    suggestionLimit: 5,
  };

  private destroy$ = new Subject<void>();

  private readonly textFields = ["title", "course", "program", "year"];

  private readonly immediateFields = [
    "startDate",
    "endDate",
    "questions",
    "closingMode",
    "customClosingKeywords",
    "defaultSessionDuration",
  ];

  /**
   * MetadataComponent constructor
   * @param fb Form builder used to build the metadata form
   */
  constructor(public fb: FormBuilder) {
    super();
  }

  /**
   * When the component is initialized, we initialize startDate and endDate with data from dataService
   */
  ngOnInit() {
    this.metadata.startDate = this.metadata.startDate && moment(this.metadata.startDate, "YYYY-MM-DD HH:mm").format("YYYY-MM-DDTHH:mm");
    this.metadata.endDate = this.metadata.endDate && moment(this.metadata.endDate, "YYYY-MM-DD HH:mm").format("YYYY-MM-DDTHH:mm");
    this.createFormGroup();
    this.listenToFieldChanges();
  }

  ngAfterViewInit() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.titleInput && this.titleInput.inputElement) {
          this.titleInput.inputElement.nativeElement.focus({ preventScroll: true });
        }
      });
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Adds multiple questions from the questions assistant popover
   */
  onAddQuestionsFromAssistant(questions: string[]) {
    if (this.questionsChooser) {
      this.questionsChooser.addQuestions(questions);
    }
  }

  /**
   * Called by the parent on every save attempt. Keeps the required-title feedback in sync with the save lifecycle.
   */
  notifySaveAttempt() {
    this.titleSaveAttempted = true;
  }

  private listenToFieldChanges() {
    this.textFields.forEach((name) => {
      this.metadataForm
        .get(name)
        ?.valueChanges.pipe(takeUntil(this.destroy$))
        .subscribe(() => this.modifyText());
    });
    this.immediateFields.forEach((name) => {
      this.metadataForm
        .get(name)
        ?.valueChanges.pipe(takeUntil(this.destroy$))
        .subscribe(() => this.modify());
    });
  }

  private createFormGroup() {
    this.metadataForm = this.fb.group({
      title: [this.metadata.title, [Validators.required, Validators.pattern(/\S/)]],
      course: [this.metadata.course],
      program: [this.metadata.program],
      year: [this.metadata.year],
      startDate: [this.metadata.startDate ? new Date(this.metadata.startDate) : null],
      endDate: [this.metadata.endDate ? new Date(this.metadata.endDate) : null],
      questions: [this.metadata.questions || []],
      closingMode: [this.metadata.resolvedClosingMode || "standard"],
      customClosingKeywords: [this.metadata.resolvedCustomClosingKeywords || []],
      defaultSessionDuration: [
        this.metadata.defaultSessionDuration || {
          hour: 1,
          minute: 30,
          second: 0,
        },
      ],
    });
  }
}
