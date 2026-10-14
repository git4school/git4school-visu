import {
  daysInMonth,
  fieldMaxLength,
  minutesToTime,
  orderPeriodTimes,
  padAndValidateDay,
  padMonth,
  padTimePart,
  parseTypedDate,
  sanitizeDateField,
  timeToMinutes,
} from "./date-input.util";

describe("date-input.util", () => {
  describe("fieldMaxLength", () => {
    it("should accept 4 digits for the year and 2 for the others", () => {
      expect(fieldMaxLength("year")).toBe(4);
      expect(fieldMaxLength("day")).toBe(2);
      expect(fieldMaxLength("minute")).toBe(2);
    });
  });

  describe("sanitizeDateField", () => {
    it("should keep the digits only and truncate to the field length", () => {
      expect(sanitizeDateField("a1b2c3", "day", 31)).toBe("12");
      expect(sanitizeDateField("20260310", "year", 31)).toBe("2026");
      expect(sanitizeDateField("", "month", 31)).toBe("");
    });

    it("should clamp the month, hour and minute", () => {
      expect(sanitizeDateField("99", "month", 31)).toBe("12");
      expect(sanitizeDateField("99", "hour", 31)).toBe("23");
      expect(sanitizeDateField("99", "minute", 31)).toBe("59");
      expect(sanitizeDateField("00", "month", 31)).toBe("01");
    });

    it("should clamp the day to the last day of the month", () => {
      expect(sanitizeDateField("31", "day", 28)).toBe("28");
      expect(sanitizeDateField("31", "day", 31)).toBe("31");
      expect(sanitizeDateField("00", "day", 31)).toBe("01");
    });

    it("should auto-pad a single digit that cannot start a two-digit value", () => {
      expect(sanitizeDateField("4", "month", 31)).toBe("04");
      expect(sanitizeDateField("1", "month", 31)).toBe("1");
      expect(sanitizeDateField("5", "day", 31)).toBe("05");
      expect(sanitizeDateField("3", "day", 31)).toBe("3");
      expect(sanitizeDateField("8", "hour", 31)).toBe("08");
      expect(sanitizeDateField("2", "hour", 31)).toBe("2");
      expect(sanitizeDateField("7", "minute", 31)).toBe("07");
      expect(sanitizeDateField("5", "minute", 31)).toBe("5");
    });

    it("should not pad a single year digit", () => {
      expect(sanitizeDateField("2", "year", 31)).toBe("2");
    });
  });

  describe("daysInMonth", () => {
    it("should use the real month length when the month and year are complete", () => {
      expect(daysInMonth("02", "2026")).toBe(28);
      expect(daysInMonth("02", "2024")).toBe(29);
      expect(daysInMonth("04", "2026")).toBe(30);
    });

    it("should fall back to 31 while the month or year is incomplete", () => {
      expect(daysInMonth("0", "2026")).toBe(31);
      expect(daysInMonth("02", "202")).toBe(31);
      expect(daysInMonth("13", "2026")).toBe(31);
    });
  });

  describe("padMonth / padAndValidateDay / padTimePart", () => {
    it("should left-pad single digits", () => {
      expect(padMonth("4")).toBe("04");
      expect(padMonth("12")).toBe("12");
      expect(padTimePart("4")).toBe("04");
      expect(padTimePart("")).toBe("");
      expect(padTimePart("14")).toBe("14");
    });

    it("should clamp the day to the last day of the month", () => {
      expect(padAndValidateDay("3", 31)).toBe("03");
      expect(padAndValidateDay("31", 28)).toBe("28");
      expect(padAndValidateDay("15", 31)).toBe("15");
    });
  });

  describe("parseTypedDate", () => {
    it("should report an empty input", () => {
      expect(parseTypedDate({ day: "", month: "", year: "" })).toEqual({ kind: "empty" });
    });

    it("should wait while the date is incomplete", () => {
      expect(parseTypedDate({ day: "1", month: "03", year: "2026" }).kind).toBe("pending");
      expect(parseTypedDate({ day: "10", month: "0", year: "2026" }).kind).toBe("pending");
      expect(parseTypedDate({ day: "", month: "03", year: "2026" }).kind).toBe("pending");
    });

    it("should parse a complete date", () => {
      const result = parseTypedDate({ day: "10", month: "03", year: "2026" });
      expect(result.kind).toBe("valid");
      if (result.kind === "valid") {
        expect(result.date.format("YYYY-MM-DD")).toBe("2026-03-10");
        expect(result.date.hours()).toBe(0);
      }
    });

    it("should reject an impossible date", () => {
      expect(parseTypedDate({ day: "31", month: "02", year: "2026" }).kind).toBe("pending");
      expect(parseTypedDate({ day: "10", month: "13", year: "2026" }).kind).toBe("pending");
    });

    it("should wait for a complete time when the mode expects one", () => {
      expect(parseTypedDate({ day: "10", month: "03", year: "2026", hour: "9", minute: "30" }).kind).toBe("pending");
      expect(parseTypedDate({ day: "10", month: "03", year: "2026", hour: "09", minute: "3" }).kind).toBe("pending");
    });

    it("should include the time when it is complete", () => {
      const result = parseTypedDate({ day: "10", month: "03", year: "2026", hour: "09", minute: "30" });
      expect(result.kind).toBe("valid");
      if (result.kind === "valid") {
        expect(result.date.format("YYYY-MM-DD HH:mm")).toBe("2026-03-10 09:30");
      }
    });

    it("should ignore the time when the caller does not provide it", () => {
      const result = parseTypedDate({ day: "10", month: "03", year: "2026", hour: null, minute: null });
      expect(result.kind).toBe("valid");
      if (result.kind === "valid") {
        expect(result.date.format("YYYY-MM-DD")).toBe("2026-03-10");
      }
    });
  });

  describe("time helpers", () => {
    it("should convert a time to minutes and back", () => {
      expect(timeToMinutes("09:30")).toBe(570);
      expect(timeToMinutes("00:00")).toBe(0);
      expect(minutesToTime(570)).toBe("09:30");
      expect(minutesToTime(0)).toBe("00:00");
      expect(minutesToTime(9)).toBe("00:09");
    });
  });

  describe("orderPeriodTimes", () => {
    it("should keep a period already ordered", () => {
      expect(orderPeriodTimes("09:00", "17:00")).toEqual({ start: "09:00", end: "17:00" });
    });

    it("should swap an inverted period", () => {
      expect(orderPeriodTimes("17:00", "09:00")).toEqual({ start: "09:00", end: "17:00" });
    });
    it("should keep an equal period unchanged", () => {
      expect(orderPeriodTimes("12:00", "12:00")).toEqual({ start: "12:00", end: "12:00" });
    });
  });
});
