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

  private static resolveKeyTranslation(
    key: string,
    fallback: string,
    translateService?: TranslateService
  ): string {
    if (translateService) {
      const trans = translateService.instant(key);
      if (trans && trans !== key) return trans;
    }
    return fallback;
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
        return this.resolveKeyTranslation("MODAL-SHORTCUTS.KEY_SHIFT", "Shift", translateService);
      }
      if (lower === "enter") {
        return "↵";
      }
      if (lower === "esc" || lower === "escape" || lower === "échap" || lower === "echap") {
        return this.resolveKeyTranslation("MODAL-SHORTCUTS.KEY_ESC", "Esc", translateService);
      }
      if (lower === "space" || lower === "espace") {
        return this.resolveKeyTranslation("MODAL-SHORTCUTS.KEY_SPACE", "Space", translateService);
      }
      if (lower === "delete" || lower === "del" || lower === "suppr") {
        return this.resolveKeyTranslation("MODAL-SHORTCUTS.KEY_DELETE", "Del", translateService);
      }
      return key.toUpperCase();
    });
  }

  static formatShortcut(keys: string[], translateService?: TranslateService): string {
    const isMac = this.isMac();
    return this.formatShortcutKeys(keys, translateService).join(isMac ? "" : " + ");
  }
}
