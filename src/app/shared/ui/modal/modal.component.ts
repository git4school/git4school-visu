import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from "@angular/core";

@Component({
  selector: "app-modal",
  templateUrl: "./modal.component.html",
  // No style url needed since we use global SCSS
  // Using ViewEncapsulation.None would be an option, but we just rely on global classes
  encapsulation: ViewEncapsulation.None,
})
export class ModalComponent {
  @Input() isOpen = false;
  @Input() title = "";
  @Input() size: "sm" | "md" | "lg" = "md";
  @Output() closeModal = new EventEmitter<void>();

  onClose() {
    this.isOpen = false;
    this.closeModal.emit();
  }

  // Prevent clicks inside modal from closing it
  onModalClick(event: Event) {
    event.stopPropagation();
  }
}
