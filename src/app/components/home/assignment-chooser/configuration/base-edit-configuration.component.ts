import { Component, EventEmitter, Output } from "@angular/core";

@Component({
  template: "",
})
export abstract class BaseEditConfigurationComponent {
  /**
   * Emitted for discrete changes (dates, questions, repositories, ...) that can be persisted right away.
   */
  @Output() modified = new EventEmitter<void>();

  /**
   * Emitted for free-text changes (title, course, program, year) that must be debounced by the parent.
   */
  @Output() textModified = new EventEmitter<void>();

  /**
   * Emitted when a free-text field loses focus, so the parent can flush immediately.
   */
  @Output() textBlurred = new EventEmitter<void>();

  notifyBlur() {
    this.textBlurred.emit();
  }

  protected modify() {
    this.modified.emit();
  }

  protected modifyText() {
    this.textModified.emit();
  }
}
