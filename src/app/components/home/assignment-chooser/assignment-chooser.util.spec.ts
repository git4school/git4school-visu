import {
  computePillIndicatorGeometry,
  readChooserPreferences,
  readLastProviderContext,
  sortAssignments,
  writeChooserPreferences,
} from "./assignment-chooser.util";

describe("assignment-chooser.util", () => {
  const assignment = (overrides: any = {}) => ({ id: 1, title: "TP", startDate: "2026-01-05", endDate: "2026-02-05", ...overrides });
  const progress = (start: string, end: string) => (start === "past" ? 100 : start === "future" ? 0 : 50);

  describe("sortAssignments", () => {
    it("should always keep the creation draft on top", () => {
      const list = [assignment({ id: 5 }), assignment({ id: -1 }), assignment({ id: 2 })];
      const sorted = sortAssignments(list, "title", "asc", progress);
      expect(sorted[0].id).toBe(-1);
    });

    it("should sort by the given field, case-insensitively", () => {
      const list = [assignment({ id: 1, title: "b" }), assignment({ id: 2, title: "A" }), assignment({ id: 3, title: "C" })];
      expect(sortAssignments(list, "title", "asc", progress).map((a) => a.title)).toEqual(["A", "b", "C"]);
      expect(sortAssignments(list, "title", "desc", progress).map((a) => a.title)).toEqual(["C", "b", "A"]);
    });

    it("should treat missing values as empty strings", () => {
      const list = [assignment({ id: 1, title: undefined }), assignment({ id: 2, title: "A" })];
      expect(sortAssignments(list, "title", "asc", progress)[0].title).toBeUndefined();
    });

    it("should order the urgency sort as active, finished, unprogrammed", () => {
      const list = [
        assignment({ id: 1, startDate: "past", endDate: "past" }), // terminé
        assignment({ id: 2, startDate: undefined, endDate: undefined }), // non programmé
        assignment({ id: 3, startDate: "now", endDate: "now" }), // en cours
      ];
      expect(sortAssignments(list, "daysRemaining", "asc", progress).map((a) => a.id)).toEqual([3, 1, 2]);
    });

    it("should order two active assignments by end date", () => {
      const list = [
        assignment({ id: 1, startDate: "now", endDate: "2026-02-10" }),
        assignment({ id: 2, startDate: "now", endDate: "2026-02-01" }),
      ];
      expect(sortAssignments(list, "daysRemaining", "asc", progress).map((a) => a.id)).toEqual([2, 1]);
      expect(sortAssignments(list, "daysRemaining", "desc", progress).map((a) => a.id)).toEqual([1, 2]);
    });
  });

  describe("preferences", () => {
    afterEach(() => localStorage.clear());

    it("should round-trip the preferences", () => {
      writeChooserPreferences({ sortField: "title", sortDirection: "asc", viewMode: "folders" });
      expect(readChooserPreferences()).toEqual({ sortField: "title", sortDirection: "asc", viewMode: "folders" });
    });

    it("should ignore an absent or corrupted entry", () => {
      expect(readChooserPreferences()).toBeUndefined();
      localStorage.setItem("assignment-chooser-prefs", "{not json");
      expect(readChooserPreferences()).toBeUndefined();
    });

    it("should read the last provider context", () => {
      expect(readLastProviderContext()).toEqual({ provider: undefined, host: undefined, instanceName: undefined });
      localStorage.setItem("git4school_last_provider", "gitlab");
      localStorage.setItem("git4school_last_host", "gitlab.example.com");
      localStorage.setItem("git4school_last_instance_name", "IUT");
      expect(readLastProviderContext()).toEqual({ provider: "gitlab", host: "gitlab.example.com", instanceName: "IUT" });
    });
  });

  describe("computePillIndicatorGeometry", () => {
    const button = (offsetLeft: number, offsetWidth: number): HTMLElement => {
      const el = document.createElement("button");
      Object.defineProperty(el, "offsetLeft", { value: offsetLeft });
      Object.defineProperty(el, "offsetWidth", { value: offsetWidth });
      return el;
    };

    it("should subtract the group padding and keep a fallback width", () => {
      const group = document.createElement("div");
      group.style.paddingLeft = "4px";
      expect(computePillIndicatorGeometry(button(60, 80), group)).toEqual({ left: 56, width: 80 });
      expect(computePillIndicatorGeometry(button(60, 0), group)).toEqual({ left: 56, width: 100 });
    });

    it("should never go before the group start", () => {
      expect(computePillIndicatorGeometry(button(2, 40), null).left).toBe(0);
    });
  });
});
