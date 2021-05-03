import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-edit-session',
  templateUrl: './edit-session.component.html',
  styleUrls: ['./edit-session.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditSessionComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

}
