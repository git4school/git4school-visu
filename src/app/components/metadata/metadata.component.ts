import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import moment from 'moment/src/moment';
import { ToastrService } from 'ngx-toastr';
import { TranslateService, TranslationChangeEvent } from '@ngx-translate/core';

import { DataService } from '@services/data.service';

/**
 * This component lets you modify metadata such as document title, course, year, start date and end date, questions
 */
@Component({
  selector: 'metadata',
  templateUrl: './metadata.component.html',
  styleUrls: ['./metadata.component.scss']
})
export class MetadataComponent implements OnInit {
  /**
   * A date before which commits are not retrieved from Github
   */
  startDate = '';

  /**
   * A date after which commits are not retrieved from Github
   */
  endDate = '';

  /**
   * Settings for the typeahead text input
   */
  readonly typeaheadSettings = {
    tagClass: 'badge badge-pill badge-secondary mr-1',
    suggestionLimit: 5
  };

  /**
   * MetadataComponent constructor
   * @param toastr Service used to display toasts for success or error cases
   * @param dataService Service used to store and get data
   * @param translate Service used to translate the application
   */
  constructor(
    private toastr: ToastrService,
    public dataService: DataService,
    public translate: TranslateService
  ) {}

  /**
   * When the component is initialized, we initialize startDate and endDate with data from dataService
   */
  ngOnInit() {
    this.startDate =
      this.dataService.startDate &&
      moment(this.dataService.startDate, 'YYYY-MM-DD HH:mm').format(
        'YYYY-MM-DDTHH:mm'
      );
    this.endDate =
      this.dataService.endDate &&
      moment(this.dataService.endDate, 'YYYY-MM-DD HH:mm').format(
        'YYYY-MM-DDTHH:mm'
      );
  }

  /**
   * This method is called when the form is submitted (when save button is pressed). Updates data with new values entered
   * @param form The submitted form
   */
  onSubmit(form: NgForm) {
    let f = form.form.value;

    this.dataService.title = f.title;
    this.dataService.course = f.course;
    this.dataService.program = f.program;
    this.dataService.year = f.year;
    this.dataService.startDate = f.startDate;
    this.dataService.endDate = f.endDate;
    this.dataService.questions = f.questions;

    this.translate
      .get(['SUCCESS', 'SUCCESS-MESSAGE'])
      .subscribe(translations => {
        this.toastr.success(
          translations['SUCCESS-MESSAGE'],
          translations['SUCCESS'],
          {
            progressBar: true
          }
        );
      });
  }
}
