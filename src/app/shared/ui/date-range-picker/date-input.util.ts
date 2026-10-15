import moment from "moment";

/**
 * Pure helpers behind the typed date/time fields of the date picker (`day` / `month` / `year` /
 * `hour` / `minute` inputs).
 *
 * The component owns the DOM and the component state; everything that decides *what* a keystroke
 * means (clamping, padding, parsing a complete field set) lives here so it can be tested directly.
 */

/** One field of a typed date. */
export type DateField = "day" | "month" | "year" | "hour" | "minute";

/** Maximum number of digits accepted per field. */
export function fieldMaxLength(field: DateField): number {
  return field === "year" ? 4 : 2;
}

/** Result of reading a set of typed fields. */
export type TypedDateParse =
  /** The three date fields are empty: the caller should clear the value. */
  | { kind: "empty" }
  /** Incomplete or impossible date: wait for more input. */
  | { kind: "pending" }
  | { kind: "valid"; date: moment.Moment };

/** Keeps the digits of a typed value, clamped to the field length. */
export function sanitizeDateField(rawValue: string, field: DateField, maxDays: number): string {
  const digits = (rawValue || "").replace(/\D/g, "");
  const value = digits.substring(0, fieldMaxLength(field));
  if (value.length === 0) {
    return value;
  }

  const clamped = clampFieldValue(value, field, maxDays);
  return autoPadField(clamped, field);
}

/** Clamps a field to its allowed range (month 1-12, hour 0-23, minute 0-59, day 1-`maxDays`). */
function clampFieldValue(value: string, field: DateField, maxDays: number): string {
  const num = parseInt(value, 10);
  const max = { month: 12, day: maxDays, hour: 23, minute: 59, year: 9999 }[field];

  if (num > max) {
    return max.toString();
  }
  if (value.length === 2 && num === 0 && (field === "month" || field === "day")) {
    return "01";
  }
  return value;
}

/** Pads a single digit once the value cannot be the start of a two-digit field ("4" → "04" for a month). */
function autoPadField(value: string, field: DateField): string {
  if (value.length !== 1) {
    return value;
  }

  const num = parseInt(value, 10);
  const firstDigitThreshold = { month: 1, day: 3, hour: 2, minute: 5, year: 9 }[field];
  return num > firstDigitThreshold ? `0${num}` : value;
}

/** Number of days of a month, or 31 when the month/year are not complete yet. */
export function daysInMonth(monthStr: string, yearStr: string): number {
  if (monthStr.length === 2 && yearStr.length >= 4) {
    const parsed = moment(`${yearStr}-${monthStr}-01`, "YYYY-MM-DD", true);
    if (parsed.isValid()) {
      return parsed.daysInMonth();
    }
  }
  return 31;
}

/** Left-pads a month ("4" → "04"). */
export function padMonth(monthStr: string): string {
  return monthStr.length === 1 ? `0${monthStr}` : monthStr;
}

/** Left-pads a day and clamps it to the last day of the month. */
export function padAndValidateDay(dayStr: string, maxDays: number): string {
  let value = dayStr;
  if (value.length === 1) {
    value = `0${value}`;
  }
  if (value.length === 2 && parseInt(value, 10) > maxDays) {
    value = maxDays.toString();
  }
  return value;
}

/** Left-pads a time part ("4" → "04"). */
export function padTimePart(timePart: string): string {
  return timePart && timePart.length === 1 ? `0${timePart}` : timePart;
}

/**
 * Reads a complete typed date. The optional hour/minute are only used when the caller expects them
 * (`datetime` modes) and must be complete, otherwise the parse stays pending.
 */
export function parseTypedDate(fields: {
  day: string;
  month: string;
  year: string;
  hour?: string | null;
  minute?: string | null;
}): TypedDateParse {
  if (!fields.day && !fields.month && !fields.year) {
    return { kind: "empty" };
  }

  const withTime = hasTimeFields(fields);
  if (!isCompleteDate(fields, withTime)) {
    return { kind: "pending" };
  }

  const format = withTime ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD";
  const date = moment(dateStringOf(fields, withTime), format, true);
  return date.isValid() ? { kind: "valid", date } : { kind: "pending" };
}

/** Whether the caller expects a time (both fields provided, completeness checked separately). */
function hasTimeFields(fields: { hour?: string | null; minute?: string | null }): boolean {
  const hour = fields.hour;
  const minute = fields.minute;
  return hour !== null && hour !== undefined && minute !== null && minute !== undefined;
}

/** Assembles the moment() input, with or without the time part. */
function dateStringOf(
  fields: { day: string; month: string; year: string; hour?: string | null; minute?: string | null },
  withTime: boolean,
): string {
  const date = `${fields.year}-${fields.month}-${fields.day}`;
  return withTime ? `${date} ${fields.hour}:${fields.minute}` : date;
}

/** Complete date, and complete time when the mode expects one. */
function isCompleteDate(
  fields: { day: string; month: string; year: string; hour?: string | null; minute?: string | null },
  withTime: boolean,
): boolean {
  if (fields.day.length !== 2 || fields.month.length !== 2 || fields.year.length !== 4) {
    return false;
  }
  if (!withTime) {
    return true;
  }
  return fields.hour.length === 2 && fields.minute.length === 2;
}

/** Minutes since midnight of a "HH:mm" time. */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** "HH:mm" from minutes since midnight. */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Orders a period so that the end is never before the start. A period is kept inside a single day,
 * so the two times are simply swapped when they are inverted.
 */
export function orderPeriodTimes(start: string, end: string): { start: string; end: string } {
  return timeToMinutes(start) > timeToMinutes(end) ? { start: end, end: start } : { start, end };
}
