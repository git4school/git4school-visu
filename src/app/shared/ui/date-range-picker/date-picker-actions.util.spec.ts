import moment from "moment";
import { decideDateSelection, resolveQuickRange } from "./date-picker-actions.util";

describe("date-picker-actions.util", () => {
  const d = (iso: string) => moment(iso, "YYYY-MM-DD", true);
  const range = (overrides: any = {}) => ({
    isSingleDate: false,
    hasTime: false,
    date: null,
    startDate: null,
    endDate: null,
    ...overrides,
  });

  describe("decideDateSelection", () => {
    it("should set the start on the first click of a range", () => {
      const decision = decideDateSelection(d("2026-03-10"), range());
      expect(decision.target).toBe("start");
      expect(decision.date.format("YYYY-MM-DD")).toBe("2026-03-10");
      expect(decision.close).toBeFalse();
    });

    it("should set the end on the second click", () => {
      const decision = decideDateSelection(d("2026-03-20"), range({ startDate: new Date("2026-03-10") }));
      expect(decision.target).toBe("end");
      expect(decision.close).toBeTrue();
      expect(decision.swapWith).toBeUndefined();
    });

    it("should swap the bounds when the second click is earlier", () => {
      const decision = decideDateSelection(d("2026-03-05"), range({ startDate: new Date("2026-03-10") }));
      /* L'ancien début devient la fin, et le jour cliqué devient le début. */
      expect(decision.target).toBe("end");
      expect(decision.date.format("YYYY-MM-DD")).toBe("2026-03-10");
      expect(decision.swapWith.format("YYYY-MM-DD")).toBe("2026-03-05");
    });

    it("should swap the bounds when only the end is set and the click is later", () => {
      const decision = decideDateSelection(d("2026-03-25"), range({ endDate: new Date("2026-03-20") }));
      expect(decision.target).toBe("start");
      expect(decision.date.format("YYYY-MM-DD")).toBe("2026-03-20");
      expect(decision.swapWith.format("YYYY-MM-DD")).toBe("2026-03-25");
    });

    it("should start a new selection after a complete range", () => {
      const decision = decideDateSelection(d("2026-04-01"), range({ startDate: new Date("2026-03-10"), endDate: new Date("2026-03-20") }));
      expect(decision.target).toBe("start");
      expect(decision.clearOther).toBeTrue();
      expect(decision.close).toBeFalse();
    });

    it("should keep the time of the current value in single datetime mode", () => {
      const withTime = new Date("2026-03-10T07:30:00");
      const decision = decideDateSelection(d("2026-03-15"), range({ isSingleDate: true, hasTime: true, date: withTime }));
      expect(decision.target).toBe("single");
      expect(decision.date.format("YYYY-MM-DD HH:mm")).toBe("2026-03-15 07:30");
      expect(decision.close).toBeFalse();
    });

    it("should default to noon when a single datetime has no value yet", () => {
      const decision = decideDateSelection(d("2026-03-15"), range({ isSingleDate: true, hasTime: true }));
      expect(decision.date.format("HH:mm")).toBe("12:00");
    });

    it("should close the popup for a single date without time", () => {
      const decision = decideDateSelection(d("2026-03-15"), range({ isSingleDate: true }));
      expect(decision.target).toBe("single");
      expect(decision.close).toBeTrue();
    });
  });

  describe("resolveQuickRange", () => {
    const now = moment("2026-03-11T14:35:00");

    it("should return the day for today, truncated", () => {
      const { start, end } = resolveQuickRange("today", now);
      expect(start.format("YYYY-MM-DD HH:mm")).toBe("2026-03-11 00:00");
      expect(end.isSame(start)).toBeTrue();
    });

    it("should keep the current time when asked", () => {
      const { start } = resolveQuickRange("today", now, true);
      expect(start.format("HH:mm")).toBe("14:35");
    });

    it("should cover the week (locale-dependent start) and the month", () => {
      const week = resolveQuickRange("week", now);
      /* Le début de semaine dépend de la locale : on vérifie la relation, pas un jour en dur. */
      expect(week.start.isSame(now.clone().startOf("week"))).toBeTrue();
      expect(week.end.diff(week.start, "days")).toBe(6);
      expect(week.end.hours()).toBe(0);

      expect(resolveQuickRange("month", now).start.format("YYYY-MM-DD")).toBe("2026-03-01");
      expect(resolveQuickRange("month", now).end.format("YYYY-MM-DD")).toBe("2026-03-31");
    });
  });
});
