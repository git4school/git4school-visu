import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import moment from 'moment/src/moment';
import { ToastrService } from 'ngx-toastr';
import { TranslateService, TranslationChangeEvent } from '@ngx-translate/core';

import { DataService } from '@services/data.service';

@Component({
  selector: 'metadata',
  templateUrl: './metadata.component.html',
  styleUrls: ['./metadata.component.scss']
})
export class MetadataComponent implements OnInit {
  startDate = '';
  endDate = '';
  typeaheadSettings = {
    tagClass: 'badge badge-pill badge-secondary mr-1',
    suggestionLimit: 5
  };

  constructor(
    private toastr: ToastrService,
    public dataService: DataService,
    public translate: TranslateService
  ) {}

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
