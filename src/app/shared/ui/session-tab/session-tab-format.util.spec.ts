import { buildArea, buildListTooltip, buildPolyline, formatCountdown, formatDateLabel, formatDuration } from "./session-tab-format.util";

describe("session-tab-format.util", () => {
  describe("buildPolyline / buildArea", () => {
    it("should format the points in a 0..100 box with two decimals", () => {
      expect(
        buildPolyline([
          { x: 0, y: 100 },
          { x: 12.345, y: 6.7 },
        ]),
      ).toBe("0.00,100.00 12.35,6.70");
      expect(buildPolyline([])).toBe("");
    });

    it("should close the area along the baseline", () => {
      expect(buildArea([{ x: 10, y: 20 }])).toBe("0,100 10.00,20.00 100,100");
      expect(buildArea([])).toBe("");
    });
  });

  describe("buildListTooltip", () => {
    it("should build a list and escape the values", () => {
      const html = buildListTooltip("Titre", "Aucun", ["<b>a</b>", "b"]);
      expect(html).toContain("resolved-questions-tooltip-title");
      expect(html).toContain("Titre");
      expect(html).toContain("<li>&lt;b&gt;a&lt;/b&gt;</li>");
      expect(html).toContain("<li>b</li>");
    });

    it("should fall back to the empty label", () => {
      const html = buildListTooltip("Titre", "Aucun", []);
      expect(html).toContain("peek-tooltip-empty");
      expect(html).toContain("Aucun");
      expect(html).not.toContain("<ul>");
    });

    it("should ignore blank items", () => {
      expect(buildListTooltip("T", "vide", ["  ", ""])).toContain("peek-tooltip-empty");
    });
  });

  describe("formatDuration", () => {
    it("should format hours and minutes", () => {
      expect(formatDuration(0)).toBe("0 min");
      expect(formatDuration(45 * 60000)).toBe("45 min");
      expect(formatDuration(60 * 60000)).toBe("1h");
      expect(formatDuration(90 * 60000)).toBe("1h30");
      expect(formatDuration(65 * 60000 + 15000)).toBe("1h05");
      expect(formatDuration(-1000)).toBe("0 min");
    });
  });

  describe("formatCountdown", () => {
    it("should format a countdown, with hours only when needed", () => {
      expect(formatCountdown(0)).toBe("0:00");
      expect(formatCountdown(154000)).toBe("2:34");
      expect(formatCountdown(3600000)).toBe("1:00:00");
      expect(formatCountdown(5025000)).toBe("1:23:45");
      expect(formatCountdown(-5000)).toBe("0:00");
    });
  });

  describe("formatDateLabel", () => {
    it("should format the label in the requested language", () => {
      const ms = new Date("2026-03-10T12:00:00.000Z").getTime();
      expect(formatDateLabel(ms, "fr").toLowerCase()).toContain("mars");
      expect(formatDateLabel(ms, "en").toLowerCase()).toContain("march");
      expect(formatDateLabel(ms, "")).toBeTruthy();
    });
  });
});
