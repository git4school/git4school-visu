import moment from "moment";
import {
  buildCalendarWeeks,
  formatTypedFields,
  isHoveredEnd,
  isHoveredStart,
  isInsideRange,
  isRangeLeft,
  isRangeRight,
  isSelectedEnd,
  isSelectedStart,
  RangeState,
} from "./date-picker-state.util";

describe("date-picker-state.util", () => {
  const d = (iso: string) => moment(iso, "YYYY-MM-DD", true);

  describe("buildCalendarWeeks", () => {
    it("should build six weeks of seven days starting on the first week of the month", () => {
      const weeks = buildCalendarWeeks(d("2026-03-15"), d("2026-03-10"));
      expect(weeks.length).toBe(6);
      expect(weeks.every((w) => w.length === 7)).toBeTrue();
      /* Le 1er mars 2026 est un dimanche : la grille commence donc le 1er. */
      expect(weeks[0][0].date.format("YYYY-MM-DD")).toBe("2026-03-01");
      expect(weeks[5][6].date.format("YYYY-MM-DD")).toBe("2026-04-11");
      expect(weeks[0][0].isCurrentMonth).toBeTrue();
      expect(weeks[5][6].isCurrentMonth).toBeFalse();
    });

    it("should flag today and keep every day of the month", () => {
      const weeks = buildCalendarWeeks(d("2026-03-15"), d("2026-03-20"));
      const flat = weeks.reduce((days, week) => days.concat(week), [] as any[]);
      expect(flat.filter((day) => day.isToday).length).toBe(1);
      expect(flat.filter((day) => day.isCurrentMonth).length).toBe(31);
    });
  });

  describe("formatTypedFields", () => {
    it("should format the day, month and year", () => {
      expect(formatTypedFields(d("2026-03-09"), false)).toEqual({ day: "09", month: "03", year: "2026", hour: "", minute: "" });
    });

    it("should add the time when asked", () => {
      expect(formatTypedFields(moment("2026-03-09T07:05:00"), true)).toEqual({
        day: "09",
        month: "03",
        year: "2026",
        hour: "07",
        minute: "05",
      });
    });

    it("should return empty fields without a date", () => {
      expect(formatTypedFields(null, true)).toEqual({ day: "", month: "", year: "", hour: "", minute: "" });
    });
  });

  describe("range predicates", () => {
    const state: RangeState = {
      isSingleDate: false,
      startDate: new Date("2026-03-10T00:00:00"),
      endDate: new Date("2026-03-20T00:00:00"),
      hoverDate: null,
    };

    it("should flag the selected bounds", () => {
      expect(isSelectedStart(state, d("2026-03-10"))).toBeTrue();
      expect(isSelectedStart(state, d("2026-03-11"))).toBeFalse();
      expect(isSelectedEnd(state, d("2026-03-20"))).toBeTrue();
      expect(isSelectedEnd(state, d("2026-03-19"))).toBeFalse();
    });

    it("should flag the days strictly inside the range", () => {
      expect(isInsideRange(state, d("2026-03-15"))).toBeTrue();
      expect(isInsideRange(state, d("2026-03-10"))).toBeFalse();
      expect(isInsideRange(state, d("2026-03-20"))).toBeFalse();
      expect(isInsideRange({ ...state, isSingleDate: true }, d("2026-03-15"))).toBeFalse();
    });

    it("should preview a forward selection", () => {
      const forward: RangeState = { ...state, endDate: null, hoverDate: d("2026-03-18") };
      expect(isInsideRange(forward, d("2026-03-15"))).toBeTrue();
      expect(isHoveredEnd(forward, d("2026-03-18"))).toBeTrue();
      expect(isHoveredStart(forward, d("2026-03-18"))).toBeFalse();
      expect(isRangeRight(forward, d("2026-03-10"))).toBeTrue();
      expect(isRangeLeft(forward, d("2026-03-10"))).toBeFalse();
    });

    it("should preview a backward selection", () => {
      const backward: RangeState = { ...state, endDate: null, hoverDate: d("2026-03-05") };
      expect(isInsideRange(backward, d("2026-03-07"))).toBeTrue();
      expect(isHoveredStart(backward, d("2026-03-05"))).toBeTrue();
      expect(isHoveredEnd(backward, d("2026-03-05"))).toBeFalse();
      expect(isRangeLeft(backward, d("2026-03-10"))).toBeTrue();
      expect(isRangeRight(backward, d("2026-03-10"))).toBeFalse();
    });

    it("should have no preview without a hovered day", () => {
      const pending: RangeState = { ...state, endDate: null, hoverDate: null };
      expect(isInsideRange(pending, d("2026-03-15"))).toBeFalse();
      expect(isRangeRight(pending, d("2026-03-10"))).toBeFalse();
    });

    it("should ignore the range logic in single-date mode", () => {
      const single: RangeState = { isSingleDate: true, date: new Date("2026-03-10T00:00:00"), hoverDate: null };
      expect(isSelectedStart(single, d("2026-03-10"))).toBeTrue();
      expect(isRangeRight(single, d("2026-03-10"))).toBeFalse();
      expect(isHoveredEnd(single, d("2026-03-10"))).toBeFalse();
    });
  });
});
