import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import { driver } from "driver.js";

@Injectable({
  providedIn: "root",
})
export class TourService {
  private hasSeenTourKey = "hasSeenTour";
  private driverObj: any;

  constructor(
    private translate: TranslateService,
    private router: Router
  ) {}

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
      nextBtnText: this.translate.instant("TOUR.NEXT"),
      prevBtnText: this.translate.instant("TOUR.PREVIOUS"),
      doneBtnText: this.translate.instant("TOUR.DONE"),
      allowClose: true,
      onDestroyStarted: () => {
        if (this.driverObj) {
          this.driverObj.destroy();
        }
        this.markTourAsSeen();
      },
      steps: [
        {
          popover: {
            title: this.translate.instant("TOUR.WELCOME_TITLE"),
            description: this.translate.instant("TOUR.WELCOME_DESC"),
            align: "center",
          },
        },
        {
          popover: {
            title: this.translate.instant("TOUR.GIT4SCHOOL_GOAL_TITLE"),
            description: this.translate.instant("TOUR.GIT4SCHOOL_GOAL_DESC"),
            align: "center",
          },
        },
        {
          popover: {
            title: this.translate.instant("TOUR.DATA_STRUCTURE_TITLE"),
            description: this.translate.instant("TOUR.DATA_STRUCTURE_DESC"),
            align: "center",
          },
        },
        {
          element: "#tour-create-assignment-btn",
          popover: {
            title: this.translate.instant("TOUR.CREATE_BTN_TITLE"),
            description: this.translate.instant("TOUR.CREATE_BTN_DESC"),
            side: "bottom",
            align: "start",
            onPopoverRender: (popover, { config, state }) => {
              const nextBtn = document.querySelector(
                ".driver-popover-next-btn"
              ) as HTMLElement;
              if (nextBtn) nextBtn.style.display = "none";
              const createBtn = document.querySelector(
                "#tour-create-assignment-btn"
              ) as HTMLElement;
              const handleCreateClick = () => {
                createBtn.removeEventListener("click", handleCreateClick);
                setTimeout(() => this.nextStep(), 300);
              };
              if (createBtn)
                createBtn.addEventListener("click", handleCreateClick);
            },
          },
        },
        {
          element: "#title",
          popover: {
            title: this.translate.instant("TOUR.TITLE_FIELD_TITLE"),
            description: this.translate.instant("TOUR.TITLE_FIELD_DESC"),
            side: "bottom",
            align: "start",
            onPopoverRender: (popover, { config, state }) => {
              const nextBtn = document.querySelector(
                ".driver-popover-next-btn"
              ) as HTMLElement;
              if (nextBtn) nextBtn.style.display = "none";
              const input = (document.querySelector("#title input") ||
                document.querySelector("#title")) as HTMLInputElement;
              const handleFocus = () => {
                input.removeEventListener("focus", handleFocus);
                this.typeText("title", "Test Onboarding", () => {
                  setTimeout(() => this.nextStep(), 500);
                });
              };
              if (input) input.addEventListener("focus", handleFocus);
            },
          },
        },
        {
          element: "#course",
          popover: {
            title: this.translate.instant("TOUR.COURSE_PROGRAM_TITLE"),
            description: this.translate.instant("TOUR.COURSE_PROGRAM_DESC"),
            side: "bottom",
            align: "start",
            onPopoverRender: (popover, { config, state }) => {
              const nextBtn = document.querySelector(
                ".driver-popover-next-btn"
              ) as HTMLElement;
              if (nextBtn) nextBtn.style.display = "none";
              const input = (document.querySelector("#course input") ||
                document.querySelector("#course")) as HTMLInputElement;
              const handleFocus = () => {
                input.removeEventListener("focus", handleFocus);
                this.typeText("course", "Git4School", () => {
                  this.typeText("program", "M1", () => {
                    setTimeout(() => this.nextStep(), 500);
                  });
                });
              };
              if (input) input.addEventListener("focus", handleFocus);
            },
          },
        },
        {
          element: "#tour-questions",
          popover: {
            title: this.translate.instant("TOUR.QUESTIONS_TITLE"),
            description: this.translate.instant("TOUR.QUESTIONS_DESC"),
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-dates",
          popover: {
            title: this.translate.instant("TOUR.DATES_TITLE"),
            description: this.translate.instant("TOUR.DATES_DESC"),
            side: "top",
            align: "start",
          },
        },
        {
          element: "#tour-repositories-tab",
          popover: {
            title: this.translate.instant("TOUR.REPOSITORIES_TAB_TITLE"),
            description: this.translate.instant("TOUR.REPOSITORIES_TAB_DESC"),
            side: "bottom",
            align: "start",
            onPopoverRender: (popover, { config, state }) => {
              const nextBtn = document.querySelector(
                ".driver-popover-next-btn"
              ) as HTMLElement;
              if (nextBtn) nextBtn.style.display = "none";
              const tab = document.querySelector(
                "#tour-repositories-tab"
              ) as HTMLElement;
              const handleTabClick = () => {
                tab.removeEventListener("click", handleTabClick);
                setTimeout(() => this.nextStep(), 300);
              };
              if (tab) tab.addEventListener("click", handleTabClick);
            },
          },
        },
        {
          element: "#tour-add-empty-repo-btn",
          popover: {
            title: this.translate.instant("TOUR.REPOSITORIES_MANUAL_ADD_TITLE"),
            description: this.translate.instant(
              "TOUR.REPOSITORIES_MANUAL_ADD_DESC"
            ),
            side: "bottom",
            align: "start",
            onPopoverRender: (popover, { config, state }) => {
              const nextBtn = document.querySelector(
                ".driver-popover-next-btn"
              ) as HTMLElement;
              if (nextBtn) nextBtn.style.display = "none";
              const addBtn = document.querySelector(
                "#tour-add-empty-repo-btn"
              ) as HTMLElement;
              const handleAddClick = () => {
                addBtn.removeEventListener("click", handleAddClick);
                setTimeout(() => this.nextStep(), 300);
              };
              if (addBtn) addBtn.addEventListener("click", handleAddClick);
            },
          },
        },
        {
          element: "#url-0",
          popover: {
            title: this.translate.instant("TOUR.REPOSITORY_URL_TITLE"),
            description: this.translate.instant("TOUR.REPOSITORY_URL_DESC"),
            side: "bottom",
            align: "start",
            onPopoverRender: (popover, { config, state }) => {
              const nextBtn = document.querySelector(
                ".driver-popover-next-btn"
              ) as HTMLElement;
              if (nextBtn) nextBtn.style.display = "none";

              const waitForElem = setInterval(() => {
                const input = (document.querySelector("#url-0 input") ||
                  document.querySelector("#url-0")) as HTMLInputElement;
                if (input) {
                  clearInterval(waitForElem);
                  const handleFocus = () => {
                    input.removeEventListener("focus", handleFocus);
                    this.typeText(
                      "url-0",
                      "https://github.com/git4school/git4school-visu",
                      () => {
                        setTimeout(() => this.nextStep(), 500);
                      }
                    );
                  };
                  input.addEventListener("focus", handleFocus);
                }
              }, 100);
            },
          },
        },
        {
          element: ".repository-card-edit .edit-row",
          popover: {
            title: this.translate.instant("TOUR.REPO_NAME_GROUP_TITLE"),
            description: this.translate.instant("TOUR.REPO_NAME_GROUP_DESC"),
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-validate-repo-0",
          popover: {
            title: this.translate.instant("TOUR.VALIDATE_REPO_TITLE"),
            description: this.translate.instant("TOUR.VALIDATE_REPO_DESC"),
            side: "bottom",
            align: "start",
            onPopoverRender: (popover, { config, state }) => {
              const nextBtn = document.querySelector(
                ".driver-popover-next-btn"
              ) as HTMLElement;
              if (nextBtn) nextBtn.style.display = "none";

              const waitForBtn = setInterval(() => {
                const valBtn = document.querySelector(
                  "#tour-validate-repo-0"
                ) as HTMLButtonElement;
                if (valBtn && !valBtn.disabled) {
                  clearInterval(waitForBtn);
                  const handleValClick = () => {
                    valBtn.removeEventListener("click", handleValClick);
                    setTimeout(() => this.nextStep(), 300);
                  };
                  valBtn.addEventListener("click", handleValClick);
                }
              }, 100);
            },
          },
        },
        {
          element: "#tour-add-search-repo-btn",
          popover: {
            title: this.translate.instant("TOUR.SEARCH_BTN_TITLE"),
            description: this.translate.instant("TOUR.SEARCH_BTN_DESC"),
            side: "bottom",
            align: "start",
            onPopoverRender: (popover, { config, state }) => {
              const nextBtn = document.querySelector(
                ".driver-popover-next-btn"
              ) as HTMLElement;
              if (nextBtn) nextBtn.style.display = "none";
              const searchBtn = document.querySelector(
                "#tour-add-search-repo-btn"
              ) as HTMLElement;
              const handleSearchClick = () => {
                searchBtn.removeEventListener("click", handleSearchClick);
                setTimeout(() => this.nextStep(), 300);
              };
              if (searchBtn)
                searchBtn.addEventListener("click", handleSearchClick);
            },
          },
        },
        {
          element: "#tour-modal-search-input",
          popover: {
            title: this.translate.instant("TOUR.SEARCH_ORG_TITLE"),
            description: this.translate.instant("TOUR.SEARCH_ORG_DESC"),
            side: "bottom",
            align: "start",
            onPopoverRender: (popover, { config, state }) => {
              const nextBtn = document.querySelector(
                ".driver-popover-next-btn"
              ) as HTMLElement;
              if (nextBtn) nextBtn.style.display = "none";
              const waitForInput = setInterval(() => {
                const input = document.querySelector(
                  "#tour-modal-search-input"
                ) as HTMLInputElement;
                if (input) {
                  clearInterval(waitForInput);
                  const handleFocus = () => {
                    input.removeEventListener("focus", handleFocus);
                    this.typeText(
                      "tour-modal-search-input",
                      "elaastic/",
                      () => {
                        const waitForTable = setInterval(() => {
                          const row = document.querySelector(
                            "app-modal-add-repositories tbody tr.table-row"
                          ) as HTMLElement;
                          if (row) {
                            clearInterval(waitForTable);
                            setTimeout(() => this.nextStep(), 500);
                          }
                        }, 100);
                      }
                    );
                  };
                  input.addEventListener("focus", handleFocus);
                }
              }, 100);
            },
          },
        },
        {
          element: "app-modal-add-repositories .modern-table-container",
          popover: {
            title: this.translate.instant("TOUR.SEARCH_ORG_RESULT_TITLE"),
            description: this.translate.instant("TOUR.SEARCH_ORG_RESULT_DESC"),
            side: "left",
            align: "start",
          },
        },
        {
          element: "#tour-modal-search-input",
          popover: {
            title: this.translate.instant("TOUR.SEARCH_SPECIFIC_TITLE"),
            description: this.translate.instant("TOUR.SEARCH_SPECIFIC_DESC"),
            side: "bottom",
            align: "start",
            onPopoverRender: (popover, { config, state }) => {
              const nextBtn = document.querySelector(
                ".driver-popover-next-btn"
              ) as HTMLElement;
              if (nextBtn) nextBtn.style.display = "none";

              const input = document.querySelector(
                "#tour-modal-search-input"
              ) as HTMLInputElement;
              if (input) {
                this.typeText(
                  "tour-modal-search-input",
                  "elaastic/elaastix",
                  () => {
                    const waitForSpecificResult = setInterval(() => {
                      const row = document.querySelector(
                        "app-modal-add-repositories tbody tr.table-row"
                      ) as HTMLElement;
                      if (
                        row &&
                        row.innerText.toLowerCase().includes("elaastix")
                      ) {
                        clearInterval(waitForSpecificResult);
                        setTimeout(() => this.nextStep(), 500);
                      }
                    }, 100);
                  }
                );
              }
            },
          },
        },
        {
          element: "app-modal-add-repositories .modern-table-container",
          popover: {
            title: this.translate.instant("TOUR.SEARCH_SPECIFIC_RESULT_TITLE"),
            description: this.translate.instant(
              "TOUR.SEARCH_SPECIFIC_RESULT_DESC"
            ),
            side: "left",
            align: "start",
            onPopoverRender: (popover, { config, state }) => {
              const nextBtn = document.querySelector(
                ".driver-popover-next-btn"
              ) as HTMLElement;
              if (nextBtn) nextBtn.style.display = "none";

              const waitForRow = setInterval(() => {
                const firstRow = document.querySelector(
                  "app-modal-add-repositories tbody tr.table-row"
                ) as HTMLElement;
                if (firstRow) {
                  clearInterval(waitForRow);
                  const handleRowClick = () => {
                    firstRow.removeEventListener("click", handleRowClick);
                    setTimeout(() => this.nextStep(), 500);
                  };
                  firstRow.addEventListener("click", handleRowClick);
                }
              }, 100);
            },
          },
        },
        {
          element: "#tour-modal-tp-group",
          popover: {
            title: this.translate.instant("TOUR.TP_GROUP_TITLE"),
            description: this.translate.instant("TOUR.TP_GROUP_DESC"),
            side: "top",
            align: "start",
            onPopoverRender: (popover, { config, state }) => {
              const nextBtn = document.querySelector(
                ".driver-popover-next-btn"
              ) as HTMLElement;
              if (nextBtn) nextBtn.style.display = "none";
              this.typeText(
                "tour-modal-tp-group",
                this.translate.instant("TOUR.TP_GROUP_DEMO"),
                () => {
                  setTimeout(() => {
                    if (nextBtn) nextBtn.style.display = "block";
                  }, 500);
                }
              );
            },
          },
        },
        {
          element: "#tour-modal-add-btn",
          popover: {
            title: this.translate.instant("TOUR.ADD_SEARCH_BTN_TITLE"),
            description: this.translate.instant("TOUR.ADD_SEARCH_BTN_DESC"),
            side: "top",
            align: "start",
            onPopoverRender: (popover, { config, state }) => {
              const nextBtn = document.querySelector(
                ".driver-popover-next-btn"
              ) as HTMLElement;
              if (nextBtn) nextBtn.style.display = "none";
              const btn = document.querySelector(
                "#tour-modal-add-btn"
              ) as HTMLElement;
              const handleBtnClick = () => {
                btn.removeEventListener("click", handleBtnClick);
                setTimeout(() => this.nextStep(), 500);
              };
              if (btn) btn.addEventListener("click", handleBtnClick);
            },
          },
        },
        {
          element: "#tour-save-btn",
          popover: {
            title: this.translate.instant("TOUR.SAVE_BTN_TITLE"),
            description: this.translate.instant("TOUR.SAVE_BTN_DESC"),
            side: "bottom",
            align: "start",
            onPopoverRender: (popover, { config, state }) => {
              const nextBtn = document.querySelector(
                ".driver-popover-next-btn"
              ) as HTMLElement;
              if (nextBtn) nextBtn.style.display = "none";

              const saveBtn = document.querySelector(
                "#tour-save-btn"
              ) as HTMLButtonElement;
              if (saveBtn) {
                const handleSaveClick = () => {
                  saveBtn.removeEventListener("click", handleSaveClick);
                  const waitForClose = setInterval(() => {
                    if (!document.querySelector("app-configuration")) {
                      clearInterval(waitForClose);
                      setTimeout(() => this.nextStep(), 500);
                    }
                  }, 200);
                };
                saveBtn.addEventListener("click", handleSaveClick);
              }
            },
          },
        },
        {
          element: "#tour-export-btn",
          popover: {
            title: this.translate.instant("TOUR.EXPORT_TITLE"),
            description: this.translate.instant("TOUR.EXPORT_DESC"),
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-import-btn",
          popover: {
            title: this.translate.instant("TOUR.IMPORT_TITLE"),
            description: this.translate.instant("TOUR.IMPORT_DESC"),
            side: "bottom",
            align: "start",
          },
        },
        {
          element: ".assignment-card:first-child .btn-icon-action.text-primary",
          popover: {
            title: this.translate.instant("TOUR.ACCESS_TITLE"),
            description: this.translate.instant("TOUR.ACCESS_DESC"),
            side: "left",
            align: "start",
          },
        },
      ],
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
  public typeText(
    elementId: string,
    text: string,
    callback?: () => void
  ): void {
    const el = (document.querySelector("#" + elementId + " input") ||
      document.getElementById(elementId)) as HTMLInputElement;
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
}
