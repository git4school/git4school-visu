import { Component, OnInit } from "@angular/core";
import { NgForm } from "@angular/forms";
import { DataService } from "@services/data.service";
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
  extends BaseEditConfigurationComponent
  implements OnInit {
  /**
   * A date before which commits are not retrieved from Github
   */
  startDate = "";

  /**
   * A date after which commits are not retrieved from Github
   */
  endDate = "";

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
   * @param dataService Service used to store and get data
   */
  constructor(public dataService: DataService) {
    super();
  }

  /**
   * When the component is initialized, we initialize startDate and endDate with data from dataService
   */
  ngOnInit() {
    this.startDate =
      this.dataService.startDate &&
      moment(this.dataService.startDate, "YYYY-MM-DD HH:mm").format(
        "YYYY-MM-DDTHH:mm"
      );
    this.endDate =
      this.dataService.endDate &&
      moment(this.dataService.endDate, "YYYY-MM-DD HH:mm").format(
        "YYYY-MM-DDTHH:mm"
      );
  }

  ngOnDestroy() {}

  /**
   * This method is called when the form is submitted (when save button is pressed). Updates data with new values entered
   * @param form The submitted form
   */
  onSubmit(form: NgForm) {
    let metadata = form.form.value;

    this.save.emit(metadata);
  }
}
