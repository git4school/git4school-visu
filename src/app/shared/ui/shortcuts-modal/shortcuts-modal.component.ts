import { Component, HostListener, Optional } from "@angular/core";
import { CustomModalRef } from "@shared/ui/custom-modal/custom-modal-ref";
import { OsUtils } from "@utils/os.utils";

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

  get modifierKey(): string {
    return OsUtils.modifierKey;
  }

  @HostListener("document:keydown", ["$event"])
  onKeyDown(event: KeyboardEvent) {
    if (OsUtils.isTypingInInput(event)) {
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
