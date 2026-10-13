import { Injectable } from "@angular/core";
import { environment } from "@environments/environment";
import { CustomModalRef } from "@shared/ui/custom-modal/custom-modal-ref";
import { CustomModalService } from "@shared/ui/custom-modal/custom-modal.service";
import { WHATS_NEW_RELEASES, WhatsNewRelease } from "@shared/ui/whats-new/whats-new.data";
import { WhatsNewModalComponent } from "@shared/ui/whats-new/whats-new-modal.component";

/**
 * Drives the "What's New" modal: it decides when the highlights of the running version have
 * not been seen yet, and opens the modal on demand from the sidebar.
 */
@Injectable({
  providedIn: "root",
})
export class WhatsNewService {
  /** LocalStorage key holding the most recent version whose highlights the user has seen. */
  public static readonly STORAGE_KEY = "git4school_last_seen_version";

  constructor(private customModalService: CustomModalService) {}

  /**
   * Release highlighted for the running version, or undefined when this version has no highlights.
   */
  public getCurrentRelease(): WhatsNewRelease | undefined {
    return WHATS_NEW_RELEASES.find((release) => release.version === environment.version);
  }

  /**
   * Releases older than the running version, most recent first.
   */
  public getPreviousReleases(): WhatsNewRelease[] {
    return WHATS_NEW_RELEASES.filter((release) => this.compareVersions(release.version, environment.version) < 0);
  }

  /**
   * True when the running version has highlights the user has not seen yet. A first launch,
   * with no stored version, counts as unseen.
   */
  public shouldShow(): boolean {
    if (!this.getCurrentRelease()) {
      return false;
    }

    const seenVersion = this.getSeenVersion();
    if (!seenVersion) {
      return true;
    }

    /* A stored version newer than the running one means a downgrade: stay quiet. */
    return this.compareVersions(seenVersion, environment.version) < 0;
  }

  /**
   * Records that the highlights of the running version have been seen.
   */
  public markAsSeen(): void {
    try {
      localStorage.setItem(WhatsNewService.STORAGE_KEY, environment.version);
    } catch (error) {
      /* Storage may be unavailable, for example in private browsing: the modal will simply show again. */
    }
  }

  /**
   * Opens the modal on the running version, or returns null when this version has no highlights.
   */
  public open(): CustomModalRef | null {
    const currentRelease = this.getCurrentRelease();
    if (!currentRelease) {
      return null;
    }

    const modalRef = this.customModalService.open(WhatsNewModalComponent, { size: "xl" });
    modalRef.componentInstance.release = currentRelease;
    modalRef.componentInstance.previousReleases = this.getPreviousReleases();
    modalRef.result.finally(() => this.markAsSeen());
    return modalRef;
  }

  /**
   * Opens the modal once, when the running version has unseen highlights.
   */
  public showIfNeeded(): void {
    if (this.shouldShow()) {
      this.open();
    }
  }

  private getSeenVersion(): string | null {
    try {
      return localStorage.getItem(WhatsNewService.STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  /**
   * Compares two dotted versions numerically, missing or invalid parts counting as zero.
   */
  private compareVersions(left: string, right: string): number {
    const leftParts = this.splitVersion(left);
    const rightParts = this.splitVersion(right);
    const length = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < length; index++) {
      const leftPart = leftParts[index] || 0;
      const rightPart = rightParts[index] || 0;
      if (leftPart !== rightPart) {
        return leftPart < rightPart ? -1 : 1;
      }
    }

    return 0;
  }

  private splitVersion(version: string): number[] {
    return version.split(".").map((part) => parseInt(part, 10) || 0);
  }
}
