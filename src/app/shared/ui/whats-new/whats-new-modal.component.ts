import { Component, Input, Optional } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { CustomModalRef } from "@shared/ui/custom-modal/custom-modal-ref";
import { WhatsNewFeature, WhatsNewRelease } from "@shared/ui/whats-new/whats-new.data";
import { OsUtils } from "@utils/os.utils";

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
   * Shortcut fragments injected in the feature descriptions and hints, so that modifier keys and
   * key names follow the platform (⌘ and ⇧ on macOS) and the active language, as everywhere else.
   */
  get shortcutParams(): Record<string, string> {
    const key = (value: string): string => OsUtils.formatShortcutKeys([value], this.translateService)[0];
    return {
      shift: key("shift"),
      sessionsTab: key("4"),
      nowMarker: key("M"),
      groupFilter: key("G"),
    };
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
