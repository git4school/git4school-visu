import { Session } from "@models/Session.model";
import { pickDefaultSession, publishRailMetrics, sessionBoundaryMs, sessionWindow } from "./session-tab-layout.util";

describe("session-tab-layout.util", () => {
  const session = (start: string, end: string, label = "S"): Session =>
    new Session(new Date(start), new Date(end), undefined, undefined, label);

  describe("sessionBoundaryMs", () => {
    it("should accept a Date or an ISO string", () => {
      const date = new Date("2026-01-05T09:00:00.000Z");
      expect(sessionBoundaryMs(date)).toBe(date.getTime());
      expect(sessionBoundaryMs("2026-01-05T09:00:00.000Z")).toBe(date.getTime());
    });
  });

  describe("sessionWindow", () => {
    it("should expose the start and end of a session", () => {
      const window = sessionWindow(session("2026-01-05T09:00:00.000Z", "2026-01-05T11:00:00.000Z"));
      expect(window.start).toBe(new Date("2026-01-05T09:00:00.000Z").getTime());
      expect(window.end).toBe(new Date("2026-01-05T11:00:00.000Z").getTime());
    });

    it("should push the end to the next day when the session wraps around midnight", () => {
      const evening = session("2026-01-05T22:00:00.000Z", "2026-01-05T01:00:00.000Z");
      const window = sessionWindow(evening);
      expect(window.end - window.start).toBe(3 * 60 * 60 * 1000);
    });
  });

  describe("pickDefaultSession", () => {
    const running = session("2026-01-05T09:00:00.000Z", "2026-01-05T11:00:00.000Z", "en cours");
    const olderRunning = session("2026-01-05T08:00:00.000Z", "2026-01-05T10:00:00.000Z", "en cours ancien");
    const upcoming = session("2026-01-05T14:00:00.000Z", "2026-01-05T16:00:00.000Z", "à venir");
    const laterUpcoming = session("2026-01-05T18:00:00.000Z", "2026-01-05T20:00:00.000Z", "plus tard");
    const now = new Date("2026-01-05T09:30:00.000Z").getTime();

    it("should return null without sessions", () => {
      expect(pickDefaultSession([], now)).toBeNull();
    });

    it("should pick the most recently started running session", () => {
      expect(pickDefaultSession([olderRunning, running, upcoming], now)).toBe(running);
    });

    it("should fall back to the soonest upcoming session", () => {
      expect(pickDefaultSession([laterUpcoming, upcoming], now)).toBe(upcoming);
    });

    it("should fall back to the earliest session when everything is in the past", () => {
      const old = session("2026-01-04T09:00:00.000Z", "2026-01-04T11:00:00.000Z");
      const older = session("2026-01-03T09:00:00.000Z", "2026-01-03T11:00:00.000Z");
      expect(pickDefaultSession([old, older], now)).toBe(older);
    });
  });

  describe("publishRailMetrics", () => {
    const buildRail = (heights: { rail: number; counter: number; incoming: number; outgoing: number }): HTMLElement => {
      const rail = document.createElement("div");
      ["peek-counter__text", "peek-line--in", "peek-line--out"].forEach((cls, index) => {
        const child = document.createElement("div");
        child.className = cls;
        const height = [heights.counter, heights.incoming, heights.outgoing][index];
        Object.defineProperty(child, "offsetHeight", { value: height });
        rail.appendChild(child);
      });
      Object.defineProperty(rail, "clientHeight", { value: heights.rail });
      return rail;
    };

    it("should publish the three swap distances", () => {
      const rail = buildRail({ rail: 100, counter: 30, incoming: 40, outgoing: 20 });

      publishRailMetrics(rail);

      expect(rail.style.getPropertyValue("--travel")).toBe("70px"); // 100 - 30
      expect(rail.style.getPropertyValue("--out-bottom")).toBe("80px"); // 100 - 20
      expect(rail.style.getPropertyValue("--in-enter")).toBe("70px"); // max(travel, 40)
    });

    it("should start the incoming line lower than its own height needs", () => {
      const rail = buildRail({ rail: 100, counter: 10, incoming: 90, outgoing: 10 });

      publishRailMetrics(rail);

      expect(rail.style.getPropertyValue("--travel")).toBe("90px");
      expect(rail.style.getPropertyValue("--in-enter")).toBe("90px");
    });

    it("should do nothing when a measure is missing or the rail is not built yet", () => {
      const rail = buildRail({ rail: 0, counter: 30, incoming: 40, outgoing: 20 });
      publishRailMetrics(rail);
      expect(rail.style.getPropertyValue("--travel")).toBe("");

      const empty = document.createElement("div");
      publishRailMetrics(empty);
      expect(empty.style.getPropertyValue("--travel")).toBe("");
    });
  });
});
