import { Component, EventEmitter, Output } from "@angular/core";

@Component({
  template: "",
})
export abstract class BaseEditConfigurationComponent<Data> {
  @Output() modified = new EventEmitter();
  @Output() saved = new EventEmitter<Data>();
  isModified = false;

  protected modify() {
    this.isModified = true;
    this.modified.emit();
  }

  protected save(data: Data) {
    this.isModified = false;
    this.saved.emit(data);
  }
}
