import { Component, EventEmitter, Input, Output } from "@angular/core";

@Component({
  selector: "app-datepicker",
  templateUrl: "./datepicker.component.html"
})
export class DatepickerComponent {
  @Input() value = "";
  @Input() label = "";
  @Input() placeholder = "yyyy-mm-dd";
  @Input() required = false;

  @Output() valueChange = new EventEmitter<string>();

  onDateChange(event: any) {
    const newValue = event.target.value;
    this.value = newValue;
    this.valueChange.emit(newValue);
  }
}
