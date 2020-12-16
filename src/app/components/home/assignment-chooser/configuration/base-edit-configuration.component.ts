import { Component, EventEmitter, Output } from "@angular/core";

@Component({
  template: ``,
})
export abstract class BaseEditConfigurationComponent<Data> {
  @Output() modified = new EventEmitter();
  @Output() save = new EventEmitter<Data>();

  protected modify() {
    this.modified.emit();
  }
}
