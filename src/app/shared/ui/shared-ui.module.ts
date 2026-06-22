import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ModalComponent } from "./modal/modal.component";
import { DatepickerComponent } from "./datepicker/datepicker.component";
import { FormsModule } from "@angular/forms";
import { TextInputComponent } from "./text-input/text-input.component";
import { NgbModule } from "@ng-bootstrap/ng-bootstrap";
import { DateRangePickerComponent } from "./date-range-picker/date-range-picker.component";
import { TranslateModule } from "@ngx-translate/core";

import { SessionDurationPickerComponent } from "./session-duration-picker/session-duration-picker.component";

@NgModule({
  declarations: [
    ModalComponent,
    DatepickerComponent,
    TextInputComponent,
    DateRangePickerComponent,
    SessionDurationPickerComponent
  ],
  imports: [CommonModule, FormsModule, NgbModule, TranslateModule],
  exports: [
    ModalComponent,
    DatepickerComponent,
    TextInputComponent,
    DateRangePickerComponent,
    SessionDurationPickerComponent
  ]
})
export class SharedUiModule {}
