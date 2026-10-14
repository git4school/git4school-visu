import type { MacroSessionOverview } from "./sessions.component";
import type { SessionDetailedStats, StudentSessionActivity } from "@services/session-analytics.service";
import { Utils } from "@services/utils";

/**
 * Pure helpers of the sessions view: tooltip placement on a monotonic curve, resolved-questions
 * tooltip, KPI aggregation and the student/session filters.
 *
 * Kept outside the component so the aggregation rules can be tested without D3 nor a live session.
 */

/** Placement of the tooltip popped by hovering a ribbon point. */
export interface TooltipPlacement {
  x: number;
  y: number;
  placement: "top" | "bottom" | "left" | "right";
  customOffset: { x: number; y: number };
}

/**
 * Cumulative curves are monotonic non-decreasing, so a hover point always has:
 * - the Top-Left quadrant (x' < x, y' < y in SVG) free of curve points,
 * - the Bottom-Right quadrant (x' > x, y' > y in SVG) free of curve points.
 * The tooltip goes up-left when both the cursor and the point are far enough from the top/left
 * edges, and down-right otherwise.
 */
export function smartTooltipPlacement(clientX: number, clientY: number, curveX: number, curveY: number): TooltipPlacement {
  const canUseTopLeft = curveY > 50 && clientY > 190 && curveX > 60 && clientX > 160;

  return canUseTopLeft
    ? { x: clientX, y: clientY, placement: "top", customOffset: { x: -65, y: -6 } }
    : { x: clientX, y: clientY, placement: "bottom", customOffset: { x: 65, y: 6 } };
}

/** Tooltip listing the questions already resolved by the group (or the "none" message). */
export function buildResolvedQuestionsTooltip(questions: string[] | undefined, labels: { empty: string; title: string }): string {
  const resolvedQuestions = (questions || []).filter(Boolean);
  if (resolvedQuestions.length === 0) {
    return labels.empty;
  }

  const title = Utils.escapeHtml(labels.title);
  const items = resolvedQuestions.map((question) => `<li>${Utils.escapeHtml(question)}</li>`).join("");

  return `<div class="resolved-questions-tooltip"><div class="resolved-questions-tooltip-title">${title}</div><ul>${items}</ul></div>`;
}

/** Sessions kept by the global TP group filter (a session without group is always visible). */
export function filterSessionStats(stats: SessionDetailedStats[], groupFilter: string | null | undefined): SessionDetailedStats[] {
  if (!groupFilter) {
    return stats;
  }
  return stats.filter((stat) => !stat.session.tpGroup || stat.session.tpGroup === groupFilter);
}

/** Students shown by the "active / inactive" tabs of the current session. */
export function filterStudentActivity(students: StudentSessionActivity[], filter: string): StudentSessionActivity[] {
  if (filter === "active") {
    return students.filter((student) => student.status === "active");
  }
  if (filter === "inactive") {
    return students.filter((student) => student.status === "inactive" || student.status === "low");
  }
  return students;
}

/** Aggregates the KPIs displayed above the sessions timeline. */
export function buildMacroStats(stats: SessionDetailedStats[], totalQuestionsCount: number): MacroSessionOverview {
  let sumPartRate = 0;
  let totalInSessionCommits = 0;
  let totalAllCommits = 0;
  let totalDurationMinutes = 0;
  const questionsSet = new Set<string>();

  stats.forEach((stat) => {
    sumPartRate += stat.participationRate;
    totalInSessionCommits += stat.inSessionCommitsCount;
    totalAllCommits += stat.totalPeriodCommitsCount;

    const start = new Date(stat.session.startDate).getTime();
    const end = new Date(stat.gracePeriod?.effectiveEndDate || stat.session.endDate).getTime();
    totalDurationMinutes += Math.max(0, (end - start) / 60000);

    stat.questionsSummary?.forEach((summary) => {
      if (summary.closedByCount > 0) {
        questionsSet.add(summary.question);
      }
    });
  });

  const totalOutOfSessionCommits = Math.max(0, totalAllCommits - totalInSessionCommits);
  const inSessionRatio = totalAllCommits > 0 ? (totalInSessionCommits / totalAllCommits) * 100 : 100;

  return {
    totalSessionsCount: stats.length,
    averageParticipationRate: sumPartRate / stats.length,
    totalInSessionCommits,
    totalOutOfSessionCommits,
    inSessionRatio,
    outOfSessionRatio: Math.max(0, 100 - inSessionRatio),
    totalHoursSupervised: formatSupervisedHours(totalDurationMinutes),
    questionsResolvedCount: questionsSet.size,
    resolvedQuestions: Array.from(questionsSet),
    totalQuestionsCount,
    sessionsStats: stats,
  };
}

/** "65h15" (minutes are dropped when they round to zero). */
function formatSupervisedHours(totalDurationMinutes: number): string {
  const hours = Math.floor(totalDurationMinutes / 60);
  const minutes = Math.round(totalDurationMinutes % 60);
  return minutes > 0 ? `${hours}h${minutes.toString().padStart(2, "0")}` : `${hours}h`;
}
