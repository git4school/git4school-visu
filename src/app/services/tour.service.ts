import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import { Alignment, driver, DriveStep, Popover, Side } from "driver.js";

/** Driver.js "next" button, hidden on steps that advance when the user performs an action. */
const NEXT_BUTTON_SELECTOR = ".driver-popover-next-btn";
/** Repository row rendered by the "add repositories" modal table. */
const REPO_ROW_SELECTOR = "app-modal-add-repositories tbody tr.table-row";
/** Demo values typed into the assignment form while the tour runs. */
const DEMO_TITLE = "Test Onboarding";
const DEMO_COURSE = "Git4School";
const DEMO_PROGRAM = "M1";
const DEMO_REPO_URL = "https://github.com/git4school/git4school-visu";
const DEMO_SEARCH_ORG = "elaastic/";
const DEMO_SEARCH_REPO = "elaastic/elaastix";
const DEMO_SEARCH_KEYWORD = "elaastix";

/** Options for a tour step built by {@link TourService.buildStep}. */
interface TourStepOptions {
  side?: Side;
  align?: Alignment;
  /** Called once the popover is rendered; receives the hidden "next" button so it can be restored. */
  onRender?: (nextButton: HTMLElement) => void;
}

@Injectable({
  providedIn: "root",
})
export class TourService {
  private hasSeenTourKey = "hasSeenTour";
  private driverObj: any;

  constructor(private translateService: TranslateService, private router: Router) {}

  /**
   * Check if the tour should be shown (first visit).
   * Temporarily disabled.
   */
  public shouldShowTour(): boolean {
    return false;
  }

  /**
   * Mark the tour as seen.
   */
  public markTourAsSeen(): void {
    localStorage.setItem(this.hasSeenTourKey, "true");
  }

  /**
   * Start the interactive tour.
   */
  public async startTour(): Promise<void> {
    if (this.driverObj && this.driverObj.isActive()) {
      this.driverObj.destroy();
    }

    if (this.router.url !== "/home") {
      await this.router.navigate(["/home"]);
      // Allow component DOM to initialize after navigation
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    this.driverObj = driver({
      showProgress: true,
      nextBtnText: this.translateService.instant("TOUR.NEXT"),
      prevBtnText: this.translateService.instant("TOUR.PREVIOUS"),
      doneBtnText: this.translateService.instant("TOUR.DONE"),
      allowClose: true,
      onDestroyStarted: () => {
        if (this.driverObj) {
          this.driverObj.destroy();
        }
        this.markTourAsSeen();
      },
      steps: this.buildSteps(),
    });

    this.driverObj.drive();
    this.markTourAsSeen();
  }

  /**
   * Advance the tour to the next step programmatically.
   */
  public nextStep(): void {
    if (this.driverObj) {
      setTimeout(() => {
        this.driverObj.moveNext();
      }, 400); // Small delay to let the DOM update
    }
  }

  /**
   * Check if the tour is currently active
   */
  public isActive(): boolean {
    return this.driverObj && this.driverObj.isActive();
  }

  /**
   * Simulates typing text into an HTML input element
   */
  public typeText(elementId: string, text: string, callback?: () => void): void {
    const el = (document.querySelector("#" + elementId + " input") || document.getElementById(elementId)) as HTMLInputElement;
    if (!el) return;

    el.value = "";
    let i = 0;

    // Create an input event to notify Angular about the change
    const event = new Event("input", { bubbles: true });

    const typeChar = () => {
      if (i < text.length) {
        el.value += text.charAt(i);
        el.dispatchEvent(event);
        // Dispatch keyup event for keyup bindings
        const keyupEvent = new KeyboardEvent("keyup", {
          bubbles: true,
          cancelable: true,
        });
        el.dispatchEvent(keyupEvent);
        i++;
        setTimeout(typeChar, 30); // 30ms per character
      } else if (callback) {
        callback();
      }
    };

    typeChar();
  }

  /**
   * Builds the whole tour: each step targets an element (`null` for a centered step),
   * its i18n key is `<key>_TITLE` / `<key>_DESC`, and a step with an {@link TourStepOptions.onRender}
   * hook advances when the user performs the expected action instead of clicking "next".
   */
  private buildSteps(): DriveStep[] {
    return [
      this.buildStep(null, "WELCOME"),
      this.buildStep(null, "GIT4SCHOOL_GOAL"),
      this.buildStep(null, "DATA_STRUCTURE"),
      this.buildStep("#tour-create-assignment-btn", "CREATE_BTN", {
        onRender: () => this.advanceOnClick("#tour-create-assignment-btn"),
      }),
      this.buildStep("#title", "TITLE_FIELD", {
        onRender: () => this.advanceAfterTyping("#title", [["title", DEMO_TITLE]]),
      }),
      this.buildStep("#course", "COURSE_PROGRAM", {
        onRender: () =>
          this.advanceAfterTyping("#course", [
            ["course", DEMO_COURSE],
            ["program", DEMO_PROGRAM],
          ]),
      }),
      this.buildStep("#tour-questions", "QUESTIONS"),
      this.buildStep("#tour-dates", "DATES", { side: "top" }),
      this.buildStep("#tour-repositories-tab", "REPOSITORIES_TAB", {
        onRender: () => this.advanceOnClick("#tour-repositories-tab"),
      }),
      this.buildStep("#tour-add-empty-repo-btn", "REPOSITORIES_MANUAL_ADD", {
        onRender: () => this.advanceOnClick("#tour-add-empty-repo-btn"),
      }),
      this.buildStep("#url-0", "REPOSITORY_URL", {
        onRender: () => this.advanceWhenPresent("#url-0", () => this.advanceAfterTyping("#url-0", [["url-0", DEMO_REPO_URL]])),
      }),
      this.buildStep(".repository-card-edit .edit-row", "REPO_NAME_GROUP"),
      this.buildStep("#tour-validate-repo-0", "VALIDATE_REPO", {
        onRender: () =>
          this.advanceWhenPresent(
            "#tour-validate-repo-0",
            (element) => this.advanceOnEvent(element, "click"),
            (element) => !(element as HTMLButtonElement).disabled,
          ),
      }),
      this.buildStep("#tour-add-search-repo-btn", "SEARCH_BTN", {
        onRender: () => this.advanceOnClick("#tour-add-search-repo-btn"),
      }),
      this.buildStep("#tour-modal-search-input", "SEARCH_ORG", {
        onRender: () =>
          this.advanceWhenPresent("#tour-modal-search-input", () =>
            this.advanceAfterTyping("#tour-modal-search-input", [["tour-modal-search-input", DEMO_SEARCH_ORG]], () =>
              this.advanceWhen(() => !!document.querySelector(REPO_ROW_SELECTOR), { delay: 500 }),
            ),
          ),
      }),
      this.buildStep("app-modal-add-repositories .modern-table-container", "SEARCH_ORG_RESULT", { side: "left" }),
      this.buildStep("#tour-modal-search-input", "SEARCH_SPECIFIC", {
        onRender: () => {
          this.typeText("tour-modal-search-input", DEMO_SEARCH_REPO, () =>
            this.advanceWhen(
              () => {
                const row = document.querySelector(REPO_ROW_SELECTOR) as HTMLElement;
                return !!row && row.innerText.toLowerCase().includes(DEMO_SEARCH_KEYWORD);
              },
              { delay: 500 },
            ),
          );
        },
      }),
      this.buildStep("app-modal-add-repositories .modern-table-container", "SEARCH_SPECIFIC_RESULT", {
        side: "left",
        onRender: () => this.advanceWhenPresent(REPO_ROW_SELECTOR, (element) => this.advanceOnEvent(element, "click", 500)),
      }),
      this.buildStep("#tour-modal-tp-group", "TP_GROUP", {
        side: "top",
        onRender: (nextButton) =>
          this.typeText("tour-modal-tp-group", this.translateService.instant("TOUR.TP_GROUP_DEMO"), () =>
            setTimeout(() => {
              if (nextButton) nextButton.style.display = "block";
            }, 500),
          ),
      }),
      this.buildStep("#tour-modal-add-btn", "ADD_SEARCH_BTN", {
        side: "top",
        onRender: () => this.advanceOnClick("#tour-modal-add-btn", 500),
      }),
      this.buildStep("#tour-autosave", "SAVE_BTN", {
        onRender: () => this.advanceWhen(() => !document.querySelector("app-configuration"), { interval: 200, delay: 500 }),
      }),
      this.buildStep("#tour-export-btn", "EXPORT"),
      this.buildStep("#tour-import-btn", "IMPORT"),
      this.buildStep(".assignment-card:first-child .btn-icon-action.text-primary", "ACCESS", { side: "left" }),
    ];
  }

  /**
   * Builds a single driver.js step. Centered steps (no element) get `align: center`,
   * targeted steps default to `side: bottom` / `align: start`.
   */
  private buildStep(element: string | null, key: string, options: TourStepOptions = {}): DriveStep {
    const popover: Popover = {
      title: this.translateService.instant(`TOUR.${key}_TITLE`),
      description: this.translateService.instant(`TOUR.${key}_DESC`),
      ...(element ? { side: options.side ?? "bottom", align: options.align ?? "start" } : { align: "center" as Alignment }),
    };

    const onRender = options.onRender;
    if (onRender) {
      popover.onPopoverRender = () => onRender(this.hideNextButton());
    }

    return element ? { element, popover } : { popover };
  }

  /** Hides the driver.js "next" button and returns it, so a step can restore it later. */
  private hideNextButton(): HTMLElement {
    const nextButton = document.querySelector(NEXT_BUTTON_SELECTOR) as HTMLElement;
    if (nextButton) {
      nextButton.style.display = "none";
    }
    return nextButton;
  }

  /** Advances the tour when the user clicks the element matching `selector` (one-shot listener). */
  private advanceOnClick(selector: string, delay = 300): void {
    this.advanceWhenPresent(selector, (element) => this.advanceOnEvent(element, "click", delay));
  }

  /** Advances the tour after a one-shot `eventName` on `element`. */
  private advanceOnEvent(element: HTMLElement, eventName: string, delay = 300): void {
    const handler = () => {
      element.removeEventListener(eventName, handler);
      setTimeout(() => this.nextStep(), delay);
    };
    element.addEventListener(eventName, handler);
  }

  /**
   * Runs `action` as soon as `selector` matches an element (and optionally satisfies `predicate`),
   * polling every 100ms while the DOM is not ready yet.
   */
  private advanceWhenPresent(
    selector: string,
    action: (element: HTMLElement) => void,
    predicate?: (element: HTMLElement) => boolean,
  ): void {
    const tryAction = (): boolean => {
      const element = document.querySelector(selector) as HTMLElement;
      if (!element || (predicate && !predicate(element))) {
        return false;
      }
      action(element);
      return true;
    };

    if (tryAction()) {
      return;
    }
    const timer = setInterval(() => {
      if (tryAction()) {
        clearInterval(timer);
      }
    }, 100);
  }

  /** Advances the tour once `condition` is true, optionally after a delay. */
  private advanceWhen(condition: () => boolean, options: { interval?: number; delay?: number } = {}): void {
    const delay = options.delay ?? 0;
    const tryAdvance = (): boolean => {
      if (!condition()) {
        return false;
      }
      if (delay) {
        setTimeout(() => this.nextStep(), delay);
      } else {
        this.nextStep();
      }
      return true;
    };

    if (tryAdvance()) {
      return;
    }
    const timer = setInterval(() => {
      if (tryAdvance()) {
        clearInterval(timer);
      }
    }, options.interval ?? 100);
  }

  /** Waits for the user to focus a field, then types the given demo values into it. */
  private advanceAfterTyping(hostSelector: string, fields: Array<[string, string]>, done?: () => void): void {
    const input = (document.querySelector(`${hostSelector} input`) || document.querySelector(hostSelector)) as HTMLInputElement;
    if (!input) {
      return;
    }

    const handleFocus = () => {
      input.removeEventListener("focus", handleFocus);
      this.typeSequentially(fields, () => (done ? done() : setTimeout(() => this.nextStep(), 500)));
    };
    input.addEventListener("focus", handleFocus);
  }

  /** Types the given `[elementId, text]` pairs one after the other. */
  private typeSequentially(fields: Array<[string, string]>, done: () => void): void {
    const [field, ...remaining] = fields;
    this.typeText(field[0], field[1], () => (remaining.length ? this.typeSequentially(remaining, done) : done()));
  }
}
