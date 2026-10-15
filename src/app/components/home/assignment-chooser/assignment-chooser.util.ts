/**
 * Pure helpers of the assignment chooser (home view): ordering of the list, persistence of the
 * toolbar preferences and geometry of the sliding indicator.
 *
 * The component keeps the state and the DOM; everything decided here is a pure function of it.
 */

import moment from "moment";

/** Key of the toolbar preferences (sort field/direction, filters, view mode). */
export const CHOOSER_PREFS_KEY = "assignment-chooser-prefs";
/** Key of the last provider used to create an assignment. */
export const LAST_PROVIDER_KEY = "git4school_last_provider";
/** Key of the last self-hosted instance used to create an assignment. */
export const LAST_HOST_KEY = "git4school_last_host";
/** Key of the readable name of that instance. */
export const LAST_INSTANCE_NAME_KEY = "git4school_last_instance_name";

/** Persisted toolbar preferences. */
export interface ChooserPreferences {
  sortField?: string;
  sortDirection?: "asc" | "desc";
  advancedFilters?: any;
  viewMode?: "list" | "folders";
}

/** Sort fields that order the assignments by urgency instead of a raw value. */
export const URGENCY_SORT_FIELD = "daysRemaining";

/** Priority of an assignment for the "time remaining" sort: active, then finished, then unprogrammed. */
function urgencyPriority(assignment: any, getProgress: (start: string, end: string) => number): number {
  if (!assignment.startDate || !assignment.endDate) return 3;
  return getProgress(assignment.startDate, assignment.endDate) === 100 ? 2 : 1;
}

/**
 * Sorts the list in place. The creation draft always stays on top; the "time remaining" sort orders
 * by urgency (active → finished → unprogrammed) and, inside a group, by end date (active) or id.
 */
export function sortAssignments(
  assignments: any[],
  sortField: string,
  sortDirection: "asc" | "desc",
  getProgress: (start: string, end: string) => number,
): any[] {
  return assignments.sort((a, b) => {
    if (a.id === -1) return -1;
    if (b.id === -1) return 1;

    if (sortField === URGENCY_SORT_FIELD) {
      const priorityA = urgencyPriority(a, getProgress);
      const priorityB = urgencyPriority(b, getProgress);
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      const valueA = priorityA === 1 ? moment(a.endDate).valueOf() : a.id;
      const valueB = priorityB === 1 ? moment(b.endDate).valueOf() : b.id;
      return applyDirection(valueA, valueB, sortDirection);
    }

    let valueA = a[sortField];
    let valueB = b[sortField];
    if (valueA === undefined || valueA === null) valueA = "";
    if (valueB === undefined || valueB === null) valueB = "";
    if (typeof valueA === "string") valueA = valueA.toLowerCase();
    if (typeof valueB === "string") valueB = valueB.toLowerCase();

    return applyDirection(valueA, valueB, sortDirection);
  });
}

/** Compares two values, the direction flipping the result. */
function applyDirection(valueA: any, valueB: any, direction: "asc" | "desc"): number {
  if (valueA < valueB) return direction === "asc" ? -1 : 1;
  if (valueA > valueB) return direction === "asc" ? 1 : -1;
  return 0;
}

/** Reads the persisted toolbar preferences, tolerating an absent or corrupted entry. */
export function readChooserPreferences(): ChooserPreferences | undefined {
  const raw = localStorage.getItem(CHOOSER_PREFS_KEY);
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as ChooserPreferences;
  } catch (error) {
    console.error("Could not load preferences", error);
    return undefined;
  }
}

/** Persists the toolbar preferences. */
export function writeChooserPreferences(preferences: ChooserPreferences): void {
  localStorage.setItem(CHOOSER_PREFS_KEY, JSON.stringify(preferences));
}

/** Last provider/host used to create an assignment, remembered between sessions. */
export function readLastProviderContext(): { provider?: string; host?: string; instanceName?: string } {
  return {
    provider: localStorage.getItem(LAST_PROVIDER_KEY) || undefined,
    host: localStorage.getItem(LAST_HOST_KEY) || undefined,
    instanceName: localStorage.getItem(LAST_INSTANCE_NAME_KEY) || undefined,
  };
}

/** Position and width of the sliding indicator, relative to the pills group. */
export interface PillIndicatorGeometry {
  left: number;
  width: number;
}

/**
 * Geometry of the indicator under the active pill: the button's offset minus the group padding
 * (the indicator is absolutely positioned inside the group), with a 100px fallback width.
 */
export function computePillIndicatorGeometry(button: HTMLElement, group: HTMLElement | null): PillIndicatorGeometry {
  const groupPaddingLeft = group ? parseFloat(getComputedStyle(group).paddingLeft) || 4 : 4;
  return {
    left: Math.max(0, button.offsetLeft - groupPaddingLeft),
    width: button.offsetWidth || 100,
  };
}
