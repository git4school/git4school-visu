import { Component, Input, Optional } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { CustomModalRef } from "@shared/ui/custom-modal/custom-modal-ref";
import { WhatsNewFeature, WhatsNewRelease } from "@shared/ui/whats-new/whats-new.data";
import { OsUtils } from "@utils/os.utils";

/** Fragment of a translated text: either plain text, or a keyboard key rendered as a keycap. */
export interface WhatsNewTextPart {
  type: "text" | "key";
  value: string;
}

/** Marker used in the translations to render a keyboard key as a keycap, for example `[[shift]]`. */
const KEY_MARKER = /\[\[([^\]]+)\]\]/g;

/**
 * Presents the highlights of the running version, and keeps the older releases available in a
 * history panel. The content itself lives in `whats-new.data.ts` and in the i18n files.
 */
@Component({
  selector: "app-whats-new-modal",
  templateUrl: "./whats-new-modal.component.html",
  styleUrls: ["./whats-new-modal.component.scss"],
})
export class WhatsNewModalComponent {
  /** Release highlighted by the modal. */
  @Input() release: WhatsNewRelease;

  /** Older releases available in the history panel, most recent first. */
  @Input() previousReleases: WhatsNewRelease[] = [];

  /** Panel currently displayed. */
  activeTab: "current" | "history" = "current";

  /** Version whose history entry is unfolded, or null when every entry is folded. */
  expandedVersion: string | null = null;

  /** Public changelog, where the complete release notes are published. */
  readonly changelogUrl = "https://github.com/git4school/git4school-visu/blob/master/CHANGELOG.md";

  constructor(@Optional() public activeModal: CustomModalRef, private translateService: TranslateService) {}

  /**
   * Splits a translated text around `[[key]]` markers, so that keyboard keys are displayed as
   * keycaps, exactly like the tooltips and the shortcuts modal do.
   */
  parseKeys(translated: string): WhatsNewTextPart[] {
    const parts: WhatsNewTextPart[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    KEY_MARKER.lastIndex = 0;

    while ((match = KEY_MARKER.exec(translated)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", value: translated.slice(lastIndex, match.index) });
      }
      parts.push({ type: "key", value: OsUtils.formatShortcutKeys([match[1]], this.translateService)[0] });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < translated.length) {
      parts.push({ type: "text", value: translated.slice(lastIndex) });
    }

    return parts;
  }

  /**
   * Keeps the rendered fragments stable from one change detection run to the next.
   */
  trackByIndex(index: number): number {
    return index;
  }

  /**
   * Highlights presented with an illustration, laid out as large cards.
   */
  get illustratedFeatures(): WhatsNewFeature[] {
    return this.release ? this.release.features.filter((feature) => !!feature.image) : [];
  }

  /**
   * Highlights presented as text only, laid out as compact cards under the illustrated ones.
   */
  get compactFeatures(): WhatsNewFeature[] {
    return this.release ? this.release.features.filter((feature) => !feature.image) : [];
  }

  /**
   * i18n key of the label qualifying a feature.
   */
  getTagKey(feature: WhatsNewFeature): string {
    return feature.tag === "new" ? "WHATS-NEW.TAG-NEW" : "WHATS-NEW.TAG-IMPROVED";
  }

  /**
   * Opens or folds the history entry of a release.
   */
  toggleVersion(version: string): void {
    this.expandedVersion = this.expandedVersion === version ? null : version;
  }

  /**
   * Closes the modal. The service records the version as seen when the modal result settles.
   */
  close(): void {
    if (this.activeModal) {
      this.activeModal.close("close");
    }
  }
}
