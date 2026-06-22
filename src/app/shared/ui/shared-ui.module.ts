import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ModalComponent } from "./modal/modal.component";
import { DatepickerComponent } from "./datepicker/datepicker.component";
import { FormsModule } from "@angular/forms";
import { TextInputComponent } from "./text-input/text-input.component";
import { NgbModule } from "@ng-bootstrap/ng-bootstrap";

@NgModule({
  declarations: [ModalComponent, DatepickerComponent, TextInputComponent],
  imports: [CommonModule, FormsModule, NgbModule],
  exports: [ModalComponent, DatepickerComponent, TextInputComponent]
})
export class SharedUiModule {}
