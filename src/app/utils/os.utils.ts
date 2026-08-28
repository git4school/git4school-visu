import { TranslateService } from "@ngx-translate/core";

export class OsUtils {
  static isMac(): boolean {
    return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  }

  static get modifierKey(): string {
    return this.isMac() ? "⌘" : "Ctrl";
  }

  static isModifierPressed(event: KeyboardEvent): boolean {
    return this.isMac() ? event.metaKey : event.ctrlKey;
  }

  static isTypingInInput(event: Event | KeyboardEvent): boolean {
    const target = event.target as HTMLElement;
    return (
      !!target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    );
  }

  static formatShortcutKeys(keys: string[], translateService?: TranslateService): string[] {
    const isMac = this.isMac();
    return keys.map((key) => {
      const lower = key.toLowerCase();
      if (lower === "mod" || lower === "ctrl" || lower === "cmd") {
        return isMac ? "⌘" : "Ctrl";
      }
      if (lower === "alt" || lower === "opt") {
        return isMac ? "⌥" : "Alt";
      }
      if (lower === "shift") {
        if (isMac) return "⇧";
        if (translateService) {
          const trans = translateService.instant("MODAL-SHORTCUTS.KEY_SHIFT");
          if (trans && trans !== "MODAL-SHORTCUTS.KEY_SHIFT") return trans;
        }
        return "Shift";
      }
      if (lower === "enter") {
        return "↵";
      }
      if (lower === "esc" || lower === "escape" || lower === "échap" || lower === "echap") {
        if (translateService) {
          const trans = translateService.instant("MODAL-SHORTCUTS.KEY_ESC");
          if (trans && trans !== "MODAL-SHORTCUTS.KEY_ESC") return trans;
        }
        return "Esc";
      }
      if (lower === "space" || lower === "espace") {
        if (translateService) {
          const trans = translateService.instant("MODAL-SHORTCUTS.KEY_SPACE");
          if (trans && trans !== "MODAL-SHORTCUTS.KEY_SPACE") return trans;
        }
        return "Space";
      }
      if (lower === "delete" || lower === "del" || lower === "suppr") {
        if (translateService) {
          const trans = translateService.instant("MODAL-SHORTCUTS.KEY_DELETE");
          if (trans && trans !== "MODAL-SHORTCUTS.KEY_DELETE") return trans;
        }
        return "Del";
      }
      return key.toUpperCase();
    });
  }

  static formatShortcut(keys: string[], translateService?: TranslateService): string {
    const isMac = this.isMac();
    return this.formatShortcutKeys(keys, translateService).join(isMac ? "" : " + ");
  }
}
