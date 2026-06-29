import {
  Component,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  AfterViewInit,
} from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Metadata } from "@models/Metadata.model";
import { NgbDateAdapter } from "@ng-bootstrap/ng-bootstrap";
import { NgbDateNativeUTCFranceAdapter } from "@services/ngb-date-native-utcfrance-adapter.service";
import * as moment from "moment";
import { BaseEditConfigurationComponent } from "../base-edit-configuration.component";
import { TextInputComponent } from "@shared/ui/text-input/text-input.component";

/**
 * This component lets you modify metadata such as document title, course, year, start date and end date, questions
 */
@Component({
  selector: "metadata",
  templateUrl: "./metadata.component.html",
  styleUrls: ["../configuration.component.scss", "./metadata.component.scss"],
  providers: [
    { provide: NgbDateAdapter, useClass: NgbDateNativeUTCFranceAdapter },
  ],
})
export class MetadataComponent
  extends BaseEditConfigurationComponent<Metadata>
  implements OnInit, OnDestroy, AfterViewInit
{
  @Input() metadata: Metadata;
  @ViewChild("titleInput") titleInput: TextInputComponent;
  metadataForm: FormGroup;

  /**
   * Settings for the typeahead text input
   */
  readonly typeaheadSettings = {
    tagClass: "badge badge-pill badge-secondary mr-1",
    suggestionLimit: 5,
  };

  /**
   * MetadataComponent constructor
   * @param toastService Service used to display toasts for success or error cases
   */
  constructor(public fb: FormBuilder) {
    super();
  }

  /**
   * When the component is initialized, we initialize startDate and endDate with data from dataService
   */
  ngOnInit() {
    this.metadata.startDate =
      this.metadata.startDate &&
      moment(this.metadata.startDate, "YYYY-MM-DD HH:mm").format(
        "YYYY-MM-DDTHH:mm"
      );
    this.metadata.endDate =
      this.metadata.endDate &&
      moment(this.metadata.endDate, "YYYY-MM-DD HH:mm").format(
        "YYYY-MM-DDTHH:mm"
      );
    this.createFormGroup();
    this.metadataForm.valueChanges.subscribe(() => {
      this.modify();
    });
  }

  ngAfterViewInit() {
    setTimeout(() => {
      if (this.titleInput && this.titleInput.inputElement) {
        this.titleInput.inputElement.nativeElement.focus();
      }
    }, 50);
  }

  ngOnDestroy() {}

  /**
   * This method is called when the form is submitted (when save button is pressed). Updates data with new values entered
   */
  submitMetadata() {
    let modifiedMetadata = this.metadataForm.value;
    let metadata = new Metadata();
    metadata.title = modifiedMetadata.title;
    metadata.course = modifiedMetadata.course;
    metadata.program = modifiedMetadata.program;
    metadata.year = modifiedMetadata.year;
    metadata.startDate = modifiedMetadata.startDate;
    metadata.endDate = modifiedMetadata.endDate;
    metadata.questions = modifiedMetadata.questions;
    metadata.defaultSessionDuration = modifiedMetadata.defaultSessionDuration;

    this.save(metadata);
  }

  private createFormGroup() {
    this.metadataForm = this.fb.group({
      title: [this.metadata.title, Validators.required],
      course: [this.metadata.course],
      program: [this.metadata.program],
      year: [this.metadata.year],
      startDate: [
        this.metadata.startDate ? new Date(this.metadata.startDate) : null,
      ],
      endDate: [this.metadata.endDate ? new Date(this.metadata.endDate) : null],
      questions: [this.metadata.questions],
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
