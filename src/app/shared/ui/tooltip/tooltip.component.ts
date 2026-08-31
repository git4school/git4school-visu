import {
  Component,
  HostListener,
  Input,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  TemplateRef,
} from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { Subscription } from "rxjs";
import { OsUtils } from "@utils/os.utils";

@Component({
  selector: "app-tooltip",
  templateUrl: "./tooltip.component.html",
  styleUrls: ["./tooltip.component.scss"],
})
export class TooltipComponent implements OnInit, OnDestroy {
  @Input() content: string | TemplateRef<any> = "";
  @Input() placement: "top" | "bottom" | "left" | "right" = "top";
  @Input() shortcutKeys?: string[];
  @Input() context?: any;

  show = false;
  shortcutPressed = false;
  formattedShortcut = "";
  parsedShortcutKeys: string[] = [];
  isMac = false;
  private langSub?: Subscription;

  constructor(
    private cdr: ChangeDetectorRef,
    private translateService: TranslateService
  ) {}

  ngOnInit() {
    this.isMac = OsUtils.isMac();
    this.updateFormattedShortcuts();
    this.langSub = this.translateService.onLangChange.subscribe(() => {
      this.updateFormattedShortcuts();
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy() {
    if (this.langSub) {
      this.langSub.unsubscribe();
    }
  }

  private updateFormattedShortcuts() {
    if (this.shortcutKeys && this.shortcutKeys.length > 0) {
      this.formattedShortcut = OsUtils.formatShortcut(
        this.shortcutKeys,
        this.translateService
      );
      this.parsedShortcutKeys = OsUtils.formatShortcutKeys(
        this.shortcutKeys,
        this.translateService
      );
    }
  }

  isString(val: any): boolean {
    return typeof val === "string";
  }

  contentAsTemplate(): TemplateRef<any> {
    return this.content as TemplateRef<any>;
  }

  // Triggered by the service after a tiny delay so the CSS transition works
  reveal() {
    this.show = true;
    this.cdr.detectChanges();
  }

  // We listen to keydown globally. If the tooltip is shown, and it has a shortcut,
  // we check if the pressed keys match.
  @HostListener("document:keydown", ["$event"])
  handleKeyDown(event: KeyboardEvent) {
    if (!this.show || !this.shortcutKeys || this.shortcutKeys.length === 0) {
      return;
    }

    const isMac = OsUtils.isMac();
    const isCmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;
    const isAlt = event.altKey;
    const isShift = event.shiftKey;

    // Simple matching logic
    // Usually shortcuts are like ['mod', 'K'] or ['shift', 'alt', 'T']
    let match = true;

    for (const key of this.shortcutKeys) {
      const lower = key.toLowerCase();
      if (lower === "mod" || lower === "ctrl" || lower === "cmd") {
        if (!isCmdOrCtrl) match = false;
      } else if (lower === "alt" || lower === "opt") {
        if (!isAlt) match = false;
      } else if (lower === "shift") {
        if (!isShift) match = false;
      } else {
        // Character key
        let expectedKey = lower;
        if (expectedKey === "space") expectedKey = " ";

        if (event.key.toLowerCase() !== expectedKey) {
          match = false;
        }
      }
    }

    // Also check if any modifier was pressed but not in the list
    const hasModInList = this.shortcutKeys.some((k) =>
      ["mod", "ctrl", "cmd"].includes(k.toLowerCase())
    );
    if (isCmdOrCtrl && !hasModInList) match = false;

    if (match) {
      this.triggerShortcutAnimation();
    }
  }

  triggerShortcutAnimation() {
    this.shortcutPressed = true;
    this.cdr.detectChanges();
    // After animation duration, we can let the service know it should close, or let the directive handle it.
    // However, usually the action of the button will trigger a focus change or mouseleave, closing the tooltip.
    // If we want it to forcefully close:
    setTimeout(() => {
      this.show = false;
      this.cdr.detectChanges();
    }, 150); // wait for scale animation
  }
}
