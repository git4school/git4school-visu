import moment from "moment";
import type { CalendarDay } from "./date-range-picker.component";

/**
 * Pure state helpers of the date picker: the calendar grid, the typed field formatting and the
 * range predicates used by the template.
 *
 * The component owns the DOM and the inputs; everything computed here is a pure function of its
 * state (current month, selected bounds, hovered day).
 */

/** Day cell of the calendar grid. */
export function buildCalendarWeeks(viewDate: moment.Moment, today: moment.Moment): CalendarDay[][] {
  const weeks: CalendarDay[][] = [];
  const startOfCalendar = viewDate.clone().startOf("month").startOf("week");
  const current = startOfCalendar.clone();

  for (let week = 0; week < 6; week++) {
    const weekDays: CalendarDay[] = [];
    for (let day = 0; day < 7; day++) {
      weekDays.push({
        date: current.clone(),
        day: current.date(),
        isToday: current.isSame(today, "day"),
        isCurrentMonth: current.month() === viewDate.month(),
      });
      current.add(1, "days");
    }
    weeks.push(weekDays);
  }

  return weeks;
}

/** Day/month/year (and time) strings shown in the typed inputs. */
export interface TypedDateFields {
  day: string;
  month: string;
  year: string;
  hour: string;
  minute: string;
}

const EMPTY_FIELDS: TypedDateFields = { day: "", month: "", year: "", hour: "", minute: "" };

/** Formats a date into the five typed fields ("DD", "MM", "YYYY" and, when asked, "HH", "mm"). */
export function formatTypedFields(date: moment.Moment | null, withTime: boolean): TypedDateFields {
  if (!date) {
    return { ...EMPTY_FIELDS };
  }
  return {
    day: date.format("DD"),
    month: date.format("MM"),
    year: date.format("YYYY"),
    hour: withTime ? date.format("HH") : "",
    minute: withTime ? date.format("mm") : "",
  };
}

/** State the range predicates need. */
export interface RangeState {
  isSingleDate: boolean;
  /** Selected single date (single modes) or start of the range. */
  date?: Date | null;
  startDate?: Date | null;
  endDate?: Date | null;
  hoverDate?: moment.Moment | null;
}

/** Whether the day is the selected single date (or the range start). */
export function isSelectedStart(state: RangeState, day: moment.Moment): boolean {
  const reference = state.isSingleDate ? state.date : state.startDate;
  return !!reference && day.isSame(moment(reference), "day");
}

/** Whether the day is the selected range end. */
export function isSelectedEnd(state: RangeState, day: moment.Moment): boolean {
  return !!state.endDate && day.isSame(moment(state.endDate), "day");
}

/** Whether the day is strictly inside the selected range (or the previewed one). */
export function isInsideRange(state: RangeState, day: moment.Moment): boolean {
  if (state.isSingleDate) return false;

  const start = state.startDate ? moment(state.startDate) : null;
  const end = state.endDate ? moment(state.endDate) : null;

  if (start && end) {
    return day.isAfter(start, "day") && day.isBefore(end, "day");
  }

  if (start && !end && state.hoverDate) {
    if (state.hoverDate.isAfter(start, "day")) {
      return day.isAfter(start, "day") && day.isBefore(state.hoverDate, "day");
    }
    if (state.hoverDate.isBefore(start, "day")) {
      return day.isBefore(start, "day") && day.isAfter(state.hoverDate, "day");
    }
  }

  return false;
}

/** Whether the start cell is the right edge of the range (rounded corner). */
export function isRangeRight(state: RangeState, day: moment.Moment): boolean {
  if (state.isSingleDate || !state.startDate || !day.isSame(state.startDate, "day")) return false;
  if (state.endDate && moment(state.endDate).isAfter(state.startDate, "day")) return true;
  return !!(!state.endDate && state.hoverDate && state.hoverDate.isAfter(state.startDate, "day"));
}

/** Whether the start cell is the left edge of the range (the preview goes backwards). */
export function isRangeLeft(state: RangeState, day: moment.Moment): boolean {
  if (state.isSingleDate || !state.startDate || !day.isSame(state.startDate, "day")) return false;
  return !!(!state.endDate && state.hoverDate && state.hoverDate.isBefore(state.startDate, "day"));
}

/** Whether the hovered day is the previewed end (forward selection). */
export function isHoveredEnd(state: RangeState, day: moment.Moment): boolean {
  if (state.isSingleDate || state.endDate || !state.startDate || !state.hoverDate) return false;
  return day.isSame(state.hoverDate, "day") && state.hoverDate.isAfter(state.startDate, "day");
}

/** Whether the hovered day is the previewed start (backward selection). */
export function isHoveredStart(state: RangeState, day: moment.Moment): boolean {
  if (state.isSingleDate || state.endDate || !state.startDate || !state.hoverDate) return false;
  return day.isSame(state.hoverDate, "day") && state.hoverDate.isBefore(state.startDate, "day");
}
