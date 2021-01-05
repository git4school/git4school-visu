import { Component, Input, OnInit } from "@angular/core";
import { NgForm } from "@angular/forms";
import { Metadata } from "@models/Metadata.model";
import * as moment from "moment";
import { BaseEditConfigurationComponent } from "../base-edit-configuration.component";

/**
 * This component lets you modify metadata such as document title, course, year, start date and end date, questions
 */
@Component({
  selector: "metadata",
  templateUrl: "./metadata.component.html",
  styleUrls: ["./metadata.component.scss"],
})
export class MetadataComponent
  extends BaseEditConfigurationComponent<Metadata>
  implements OnInit {
  @Input()
  metadata: Metadata;

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
  constructor() {
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
  }

  ngOnDestroy() {}

  /**
   * This method is called when the form is submitted (when save button is pressed). Updates data with new values entered
   * @param form The submitted form
   */
  onSubmit(form: NgForm) {
    let modifiedMetadata = form.form.value;
    this.metadata.title = modifiedMetadata.title;
    this.metadata.course = modifiedMetadata.course;
    this.metadata.program = modifiedMetadata.program;
    this.metadata.year = modifiedMetadata.year;
    this.metadata.startDate = modifiedMetadata.startDate;
    this.metadata.endDate = modifiedMetadata.endDate;
    this.metadata.questions = modifiedMetadata.questions;

    this.save.emit(this.metadata);
  }
}
