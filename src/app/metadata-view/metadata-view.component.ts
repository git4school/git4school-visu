import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { DataService } from '../services/data.service';
import moment from 'moment/src/moment';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-metadata-view',
  templateUrl: './metadata-view.component.html',
  styleUrls: ['./metadata-view.component.scss']
})
export class MetadataViewComponent implements OnInit {
  startDate = '';
  endDate = '';

  constructor(private toastr: ToastrService, public dataService: DataService) {}

  ngOnInit() {
    console.log(this.dataService.startDate, this.dataService.endDate);
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
    console.log('f: ', f);
    this.dataService.title = f.title;
    this.dataService.course = f.course;
    this.dataService.program = f.program;
    this.dataService.year = f.year;
    this.dataService.startDate = f.startDate;
    this.dataService.endDate = f.endDate;
    this.dataService.questions = f.questions
      .split(',')
      .map(question => question.trim())
      .filter(values => {
        return Boolean(values) === true;
      });
    this.toastr.success('Changes has been saved !', 'Success', {
      progressBar: true
    });

    // navigate to graph overview
  }
}
