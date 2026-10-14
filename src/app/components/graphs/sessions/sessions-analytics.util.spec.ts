import { SessionDetailedStats, StudentSessionActivity } from "@services/session-analytics.service";
import {
  buildMacroStats,
  buildResolvedQuestionsTooltip,
  filterSessionStats,
  filterStudentActivity,
  smartTooltipPlacement,
} from "./sessions-analytics.util";

describe("sessions-analytics.util", () => {
  const stat = (label: string, tpGroup: string | undefined, overrides: Partial<SessionDetailedStats> = {}): SessionDetailedStats =>
    ({
      session: { label, tpGroup, startDate: new Date("2026-01-05T09:00:00"), endDate: new Date("2026-01-05T11:00:00") },
      participationRate: 50,
      inSessionCommitsCount: 10,
      totalPeriodCommitsCount: 20,
      gracePeriod: { effectiveEndDate: new Date("2026-01-05T11:05:00") },
      questionsSummary: [{ question: "q1", closedByCount: 1, percentage: 16 }],
      ...overrides,
    } as SessionDetailedStats);

  describe("smartTooltipPlacement", () => {
    it("should place the tooltip up-left when the point and the cursor are far from the edges", () => {
      const placement = smartTooltipPlacement(400, 400, 300, 200);
      expect(placement.placement).toBe("top");
      expect(placement.customOffset).toEqual({ x: -65, y: -6 });
      expect(placement.x).toBe(400);
    });

    it("should fall back down-right near the top or the left edge", () => {
      expect(smartTooltipPlacement(100, 400, 300, 200).placement).toBe("bottom");
      expect(smartTooltipPlacement(400, 100, 300, 200).placement).toBe("bottom");
      expect(smartTooltipPlacement(400, 400, 30, 200).placement).toBe("bottom");
      expect(smartTooltipPlacement(400, 400, 300, 20).placement).toBe("bottom");
      expect(smartTooltipPlacement(400, 400, 300, 200).customOffset).toEqual({ x: -65, y: -6 });
      expect(smartTooltipPlacement(10, 10, 10, 10).customOffset).toEqual({ x: 65, y: 6 });
    });
  });

  describe("buildResolvedQuestionsTooltip", () => {
    const labels = { empty: "Aucune", title: "Questions résolues" };

    it("should return the empty message without questions", () => {
      expect(buildResolvedQuestionsTooltip(undefined, labels)).toBe("Aucune");
      expect(buildResolvedQuestionsTooltip([], labels)).toBe("Aucune");
    });

    it("should build the list and escape the values", () => {
      const html = buildResolvedQuestionsTooltip(["<script>", "q2"], labels);
      expect(html).toContain("resolved-questions-tooltip-title");
      expect(html).toContain("<li>&lt;script&gt;</li>");
      expect(html).toContain("<li>q2</li>");
    });
  });

  describe("filterSessionStats", () => {
    const stats = [stat("S1", "TP1"), stat("S2", "TP2"), stat("S3", undefined)];

    it("should keep everything without a group filter", () => {
      expect(filterSessionStats(stats, null).length).toBe(3);
      expect(filterSessionStats(stats, "").length).toBe(3);
    });

    it("should keep the sessions of the group and the ones without group", () => {
      expect(filterSessionStats(stats, "TP1").map((s) => s.session.label)).toEqual(["S1", "S3"]);
    });
  });

  describe("filterStudentActivity", () => {
    const students = [
      { studentName: "A", status: "active" },
      { studentName: "B", status: "low" },
      { studentName: "C", status: "inactive" },
    ] as StudentSessionActivity[];

    it("should filter by status, keeping the low ones with the inactive", () => {
      expect(filterStudentActivity(students, "all").length).toBe(3);
      expect(filterStudentActivity(students, "active").map((s) => s.studentName)).toEqual(["A"]);
      expect(filterStudentActivity(students, "inactive").map((s) => s.studentName)).toEqual(["B", "C"]);
    });
  });

  describe("buildMacroStats", () => {
    it("should aggregate the sessions, the commits and the supervised hours", () => {
      const stats = [
        stat("S1", "TP1", { participationRate: 40, inSessionCommitsCount: 10, totalPeriodCommitsCount: 20 }),
        stat("S2", "TP1", { participationRate: 60, inSessionCommitsCount: 5, totalPeriodCommitsCount: 5 }),
      ];

      const macro = buildMacroStats(stats, 4);
      expect(macro.totalSessionsCount).toBe(2);
      expect(macro.averageParticipationRate).toBe(50);
      expect(macro.totalInSessionCommits).toBe(15);
      expect(macro.totalOutOfSessionCommits).toBe(10);
      expect(macro.inSessionRatio).toBe(60);
      expect(macro.outOfSessionRatio).toBe(40);
      expect(macro.questionsResolvedCount).toBe(1);
      expect(macro.resolvedQuestions).toEqual(["q1"]);
      expect(macro.totalQuestionsCount).toBe(4);
      /* 2 séances de 2h05 → 4h10. */
      expect(macro.totalHoursSupervised).toBe("4h10");
      expect(macro.sessionsStats).toBe(stats);
    });

    it("should fall back to the session end date without grace period", () => {
      const withoutGrace = stat("S1", "TP1", { gracePeriod: undefined });
      expect(buildMacroStats([withoutGrace], 0).totalHoursSupervised).toBe("2h");
    });

    it("should not count a question closed by nobody", () => {
      const unanswered = stat("S1", "TP1", { questionsSummary: [{ question: "q1", closedByCount: 0, percentage: 0 }] });
      expect(buildMacroStats([unanswered], 1).questionsResolvedCount).toBe(0);
    });
  });
});
