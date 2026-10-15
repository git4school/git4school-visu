import moment from "moment";

/**
 * Pure decisions of the date picker: the focus order of the typed fields, what a click on a day
 * means and the three quick ranges (today / this week / this month).
 *
 * The component keeps the DOM and the emitted values; everything decided here is a pure function.
 */

/** State a day click is resolved against. */
export interface DateSelectionState {
  isSingleDate: boolean;
  hasTime: boolean;
  date?: Date | null;
  startDate?: Date | null;
  endDate?: Date | null;
}

/** What a click on a day means for the picker. */
export interface DateSelectionDecision {
  /** Date to apply to {@link target}. */
  date: moment.Moment;
  /** Which bound (or the single date) receives it. */
  target: "single" | "start" | "end";
  /** Date appliquée à la borne opposée (échange d'une plage inversée). */
  swapWith?: moment.Moment;
  /** Efface la borne opposée (nouvelle sélection après une plage complète). */
  clearOther?: boolean;
  /** Whether the popup should close. */
  close: boolean;
}

/**
 * Resolves a click on a calendar day, mirroring the picker's rules: a single date keeps its time,
 * the first click sets the start, the second sets the end (swapping when it is earlier), and a
 * click on a complete range starts a new one.
 */
export function decideDateSelection(day: moment.Moment, state: DateSelectionState): DateSelectionDecision {
  const clickedDate = day.clone().startOf("day");

  if (state.isSingleDate) {
    if (state.hasTime) {
      const reference = state.date ? moment(state.date) : null;
      if (reference) {
        clickedDate.hour(reference.hour()).minute(reference.minute());
      } else {
        clickedDate.hour(12).minute(0);
      }
    }
    return { date: clickedDate, target: "single", close: !state.hasTime };
  }

  if (!state.startDate && !state.endDate) {
    return { date: clickedDate, target: "start", close: false };
  }

  if (state.startDate && !state.endDate) {
    if (clickedDate.isBefore(state.startDate)) {
      return { date: moment(state.startDate), target: "end", swapWith: clickedDate, close: true };
    }
    return { date: clickedDate, target: "end", close: true };
  }

  if (!state.startDate && state.endDate) {
    if (clickedDate.isAfter(state.endDate)) {
      return { date: moment(state.endDate), target: "start", swapWith: clickedDate, close: true };
    }
    return { date: clickedDate, target: "start", close: true };
  }

  /* Les deux bornes existent : on repart d'une nouvelle sélection. */
  return { date: clickedDate, target: "start", clearOther: true, close: false };
}

/** The three quick ranges of the picker. */
export type QuickRange = "today" | "week" | "month";

/**
 * Start/end of a quick range, computed from the (simulated) clock.
 * "Today" keeps the current time in the datetime modes (`keepTime`), and is truncated to the day otherwise.
 */
export function resolveQuickRange(range: QuickRange, now: moment.Moment, keepTime = false): { start: moment.Moment; end: moment.Moment } {
  if (range === "week") {
    return { start: now.clone().startOf("week"), end: now.clone().endOf("week").startOf("day") };
  }
  if (range === "month") {
    return { start: now.clone().startOf("month"), end: now.clone().endOf("month").startOf("day") };
  }

  const today = keepTime ? now.clone() : now.clone().startOf("day");
  return { start: today, end: today.clone() };
}
