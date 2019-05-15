import { Component, OnInit, Input } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-commit-view',
  templateUrl: './commit-view.component.html',
  styleUrls: ['./commit-view.component.scss']
})
export class CommitViewComponent implements OnInit {
  @Input() message: string;
  @Input() commitDate: Date;
  @Input() author: string;

  ngOnInit(): void {
    console.log('date : ', this.commitDate);
  }


  constructor() {}


}
