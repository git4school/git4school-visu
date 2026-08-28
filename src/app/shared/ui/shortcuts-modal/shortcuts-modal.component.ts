import { Component, HostListener, Optional } from "@angular/core";
import { CustomModalRef } from "@shared/ui/custom-modal/custom-modal-ref";
import { OsUtils } from "@app/utils/os.utils";

@Component({
  selector: "app-shortcuts-modal",
  templateUrl: "./shortcuts-modal.component.html",
  styleUrls: ["./shortcuts-modal.component.scss"],
})
export class ShortcutsModalComponent {
  constructor(@Optional() public activeModal: CustomModalRef) {}

  get isMac(): boolean {
    return OsUtils.isMac();
  }

  @HostListener("document:keydown", ["$event"])
  onKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }

    if (event.key === "?") {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }
  }

  close() {
    if (this.activeModal) {
      this.activeModal.dismiss("Close click");
    }
  }
}
