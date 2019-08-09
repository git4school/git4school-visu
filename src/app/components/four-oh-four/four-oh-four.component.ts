import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * This component is used with the 404 error
 */
@Component({
  selector: 'four-oh-four',
  templateUrl: './four-oh-four.component.html',
  styleUrls: ['./four-oh-four.component.scss']
})
export class FourOhFourComponent implements OnInit {
  /**
   * FourOhFourComponent constructor
   * @param translate Service used to translate the application
   */
  constructor(public translate: TranslateService) {}

  /**
   * This method is called when the component is initialized
   */
  ngOnInit() {}
}
