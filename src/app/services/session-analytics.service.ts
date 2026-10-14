import { Injectable } from "@angular/core";
import { Commit } from "@models/Commit.model";
import { Repository } from "@models/Repository.model";
import { Session } from "@models/Session.model";
import { AnonymizationService } from "@services/anonymization.service";
import {
  buildHistogramBuckets,
  buildLiveFeed,
  buildPace,
  buildQuestionsSummary,
  buildResolvedChart,
  classifyStudentHealth,
  classifyStudentStatus,
  commitsWithinWindow,
  computeCohortSamples,
  resolveQuestionsFromPoints,
  summariseRepoCommits,
} from "@services/session-stats.util";
import { Utils } from "@services/utils";

export interface GracePeriodResult {
  effectiveEndDate: Date;
  graceMinutes: number;
  extendedStudentsCount: number;
  isExtended: boolean;
}

export interface StudentSessionActivity {
  repository: Repository;
  studentName: string;
  tpGroup?: string;
  inSessionCommitsCount: number;
  totalCommitsCount: number;
  firstCommitDate?: Date;
  lastCommitDate?: Date;
  lastQuestionDone?: string;
  status: "active" | "low" | "inactive";
  questionsCompletedInSession: string[];
}

export interface SessionHistogramBucket {
  startDate: Date;
  endDate: Date;
  label: string;
  total: number;
  countsByColor: { [colorKey: string]: number };
  closingCommitsCount: number;
}

export interface RibbonDataPoint {
  time: Date;
  relativeMinutes: number;
  mean: number;
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
}

export interface SessionProgressRibbonData {
  timePoints: Date[];
  questionsRibbon: RibbonDataPoint[];
  commitsRibbon: RibbonDataPoint[];
  studentCommitsPoints: Array<{
    repoId: string;
    student: string;
    time: Date;
    relativeMinutes: number;
    questionIndex: number;
    questionName: string;
    cumulativeCommits: number;
    isCloture: boolean;
    commit: Commit;
  }>;
}

export interface SessionDetailedStats {
  session: Session;
  displayName: string;
  tpGroup?: string;
  gracePeriod: GracePeriodResult;
  totalEligibleStudents: number;
  activeStudentsCount: number;
  inactiveStudentsCount: number;
  studentsWithoutResolvedQuestionsCount: number;
  participationRate: number;
  inSessionCommitsCount: number;
  totalPeriodCommitsCount: number;
  inSessionRatio: number;
  resolvedQuestionsCount: number;
  questionsSummary: Array<{
    question: string;
    closedByCount: number;
    percentage: number;
  }>;
  histogramBuckets: SessionHistogramBucket[];
  ribbonData: SessionProgressRibbonData;
  studentsActivity: StudentSessionActivity[];
}

export type StudentRisk = "active" | "watch" | "inactive";

export interface StudentWatchItem {
  repository: Repository;
  studentName: string;
  risk: StudentRisk;
  /** i18n key explaining why the student needs attention. */
  reasonKey: string;
  /** Minutes since the last commit, when the reason is time-based. */
  reasonMinutes?: number;
  inSessionCommitsCount: number;
}

export interface PaceBucket {
  label: string;
  total: number;
  isCurrent: boolean;
  /** 0..100 bar height, relative to the busiest elapsed bucket. */
  height: number;
}

export interface LiveFeedItem {
  studentName: string;
  questionName: string;
  isCloture: boolean;
  minutesAgo: number;
  justNow: boolean;
  commitUrl: string;
}

/**
 * Actionable "live cockpit" indicators derived from the detailed stats, so the teacher can
 * orchestrate the session: who needs help, the class pace and the latest activity.
 */
export interface SessionLiveIndicators {
  activeCount: number;
  watchCount: number;
  inactiveCount: number;
  totalStudents: number;
  resolvedQuestions: number;
  totalQuestions: number;
  questionsPct: number;
  /** Student names per health bucket (for the hover tooltips). */
  activeStudents: string[];
  watchStudents: string[];
  inactiveStudents: string[];
  /** Names of the resolved questions (for the hover tooltip). */
  resolvedQuestionsList: string[];
  /** Live resolved-questions scatter (one dot per completion) + group average progress curve. */
  resolvedChart: {
    dots: Array<{ x: number; y: number; question: string; student: string; minutesAgo: number }>;
    average: Array<{ x: number; y: number }>;
    /** Per-student cumulative progress trajectory (0..100 box), keyed by student name. */
    trajectories: Record<string, Array<{ x: number; y: number }>>;
  };
  watchlist: StudentWatchItem[];
  pace: {
    buckets: PaceBucket[];
    commitsLast15: number;
    stalled: boolean;
  };
  feed: LiveFeedItem[];
}

export interface SuggestedSessionResult {
  session: Session;
  activeStudentsCount: number;
  commitsCount: number;
  totalGroupStudents: number;
  suggestedLabel: string;
}

@Injectable({
  providedIn: "root",
})
export class SessionAnalyticsService {
  readonly BASE_GRACE_MINUTES = 3;
  readonly MAX_GRACE_MINUTES = 30;
  readonly MAX_CONSECUTIVE_GAP_MINUTES = 4;

  /** No commit for longer than this flags a student "to nudge" and a class "stalled". */
  readonly LIVE_STALE_MINUTES = 15;
  readonly LIVE_WATCHLIST_LIMIT = 4;
  readonly LIVE_FEED_LIMIT = 4;

  constructor(private anonymizationService?: AnonymizationService) {}

  getStudentDisplayName(repo: Repository): string {
    const rawName = this.anonymizationService
      ? this.anonymizationService.getDisplayName(repo)
      : repo.getDisplayName() || repo.name || "Étudiant";
    return Utils.truncateMiddle(rawName, Utils.OVERVIEW_NAME_LENGTH_LIMIT);
  }

  /**
   * Computes the dynamic adaptive grace period for a session.
   */
  computeDynamicGracePeriod(session: Session, commits: Commit[], repositories: Repository[]): GracePeriodResult {
    if (!session || !session.endDate) {
      return {
        effectiveEndDate: session?.endDate || new Date(),
        graceMinutes: 0,
        extendedStudentsCount: 0,
        isExtended: false,
      };
    }

    const _sessionStartTime = new Date(session.startDate).getTime();
    const sessionEndTime = new Date(session.endDate).getTime();
    const baseGraceEndTime = sessionEndTime + this.BASE_GRACE_MINUTES * 60 * 1000;
    const maxGraceEndTime = sessionEndTime + this.MAX_GRACE_MINUTES * 60 * 1000;

    // Filter candidate commits matching group if specified
    const repoGroupMap = new Map<string, string>();
    repositories?.forEach((r) => {
      const group = r.tpGroup || "";
      r.commits?.forEach((c) => repoGroupMap.set(c.url, group));
    });

    const candidateCommits = (commits || [])
      .filter((c) => {
        if (!c || !c.commitDate) return false;
        const cTime = new Date(c.commitDate).getTime();
        if (cTime < sessionEndTime || cTime > maxGraceEndTime) return false;
        if (session.tpGroup) {
          const rGroup = repoGroupMap.get(c.url);
          if (rGroup && rGroup !== session.tpGroup) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(a.commitDate).getTime() - new Date(b.commitDate).getTime());

    let currentCutoffTime = baseGraceEndTime;
    let lastAcceptedTime = sessionEndTime;
    const extendedStudents = new Set<string>();

    for (const commit of candidateCommits) {
      const commitTime = new Date(commit.commitDate).getTime();

      // If commit is within the base grace, accept unconditionally
      if (commitTime <= baseGraceEndTime) {
        lastAcceptedTime = Math.max(lastAcceptedTime, commitTime);
        extendedStudents.add(commit.author || "Unknown");
        continue;
      }

      // If beyond base grace, check continuous chain gap (<= 4 min)
      const gapMinutes = (commitTime - lastAcceptedTime) / (60 * 1000);
      if (gapMinutes <= this.MAX_CONSECUTIVE_GAP_MINUTES && commitTime <= maxGraceEndTime) {
        lastAcceptedTime = commitTime;
        currentCutoffTime = Math.max(currentCutoffTime, commitTime);
        extendedStudents.add(commit.author || "Unknown");
      } else {
        // Continuous wave broken
        break;
      }
    }

    const effectiveEndDate = new Date(Math.max(sessionEndTime, currentCutoffTime));
    const graceMinutes = Math.round((effectiveEndDate.getTime() - sessionEndTime) / (60 * 1000));
    const isExtended = graceMinutes > this.BASE_GRACE_MINUTES;

    return {
      effectiveEndDate,
      graceMinutes,
      extendedStudentsCount: extendedStudents.size,
      isExtended,
    };
  }

  /**
   * Checks if a commit belongs to a session
   */
  isCommitInSession(commit: Commit, session: Session, graceMinutes = 0, repoGroup?: string): boolean {
    if (!commit || !commit.commitDate || !session || !session.startDate || !session.endDate) {
      return false;
    }

    if (session.tpGroup && repoGroup && session.tpGroup !== repoGroup) {
      return false;
    }

    const cTime = new Date(commit.commitDate).getTime();
    const sStart = new Date(session.startDate).getTime();
    const sEnd = new Date(session.endDate).getTime() + graceMinutes * 60 * 1000;

    return cTime >= sStart && cTime <= sEnd;
  }

  /**
   * Computes comprehensive analytical stats for a single session
   */
  computeSessionStats(session: Session, repositories: Repository[], questions: string[] = []): SessionDetailedStats {
    const relevantRepos = (repositories || []).filter((repo) => !session.tpGroup || repo.tpGroup === session.tpGroup);

    const allCandidateCommits: Commit[] = [];
    relevantRepos.forEach((repo) => {
      if (repo.commits) allCandidateCommits.push(...repo.commits);
    });

    const graceResult = this.computeDynamicGracePeriod(session, allCandidateCommits, relevantRepos);
    const sessionStartMs = new Date(session.startDate).getTime();
    const sessionEndMs = graceResult.effectiveEndDate.getTime();

    /* Per-student pass: in-session commits, activity status and progress-ribbon points. */
    const studentsActivity: StudentSessionActivity[] = [];
    const ribbonPoints: SessionProgressRibbonData["studentCommitsPoints"] = [];
    const closuresByQuestion = new Map<string, number>();
    questions.forEach((question) => closuresByQuestion.set(question, 0));

    let activeStudentsCount = 0;
    let inSessionCommitsCount = 0;

    relevantRepos.forEach((repo) => {
      const inSessionCommits = commitsWithinWindow(repo.commits, sessionStartMs, sessionEndMs);
      const studentName = this.getStudentDisplayName(repo);
      const summary = summariseRepoCommits(repo, inSessionCommits, sessionStartMs, questions, studentName);

      inSessionCommitsCount += summary.inSessionCommitsCount;
      if (summary.inSessionCommitsCount > 0) {
        activeStudentsCount++;
      }
      summary.closuresByQuestion.forEach((count, question) =>
        closuresByQuestion.set(question, (closuresByQuestion.get(question) || 0) + count),
      );
      ribbonPoints.push(...summary.ribbonPoints);

      studentsActivity.push({
        repository: repo,
        studentName,
        tpGroup: repo.tpGroup,
        inSessionCommitsCount: summary.inSessionCommitsCount,
        totalCommitsCount: repo.commits?.length || 0,
        firstCommitDate: summary.firstCommitDate,
        lastCommitDate: summary.lastCommitDate,
        lastQuestionDone: summary.lastQuestionDone,
        status: classifyStudentStatus(summary.inSessionCommitsCount),
        questionsCompletedInSession: summary.closedQuestions,
      });
    });

    const totalEligibleStudents = relevantRepos.length;
    const questionsSummary = buildQuestionsSummary(questions, closuresByQuestion, totalEligibleStudents);

    /* Cohort sampled for the ribbon: the students who pushed, or everybody when nobody did. */
    const activeRepos = relevantRepos.filter((repo) =>
      studentsActivity.some((activity) => activity.repository === repo && activity.status !== "inactive"),
    );
    const cohortToSample = activeRepos.length > 0 ? activeRepos : relevantRepos;
    const samples = computeCohortSamples(cohortToSample, questions, sessionStartMs, sessionEndMs);

    return {
      session,
      displayName: session.label || `Séance ${session.tpGroup ? `(${session.tpGroup})` : ""}`,
      tpGroup: session.tpGroup,
      gracePeriod: graceResult,
      totalEligibleStudents,
      activeStudentsCount,
      inactiveStudentsCount: totalEligibleStudents - activeStudentsCount,
      studentsWithoutResolvedQuestionsCount: studentsActivity.filter((activity) => activity.questionsCompletedInSession.length === 0)
        .length,
      participationRate: totalEligibleStudents > 0 ? (activeStudentsCount / totalEligibleStudents) * 100 : 0,
      inSessionCommitsCount,
      totalPeriodCommitsCount: allCandidateCommits.length,
      inSessionRatio: allCandidateCommits.length > 0 ? (inSessionCommitsCount / allCandidateCommits.length) * 100 : 100,
      resolvedQuestionsCount: questionsSummary.filter((question) => question.closedByCount > 0).length,
      questionsSummary,
      histogramBuckets: buildHistogramBuckets(ribbonPoints, sessionStartMs, sessionEndMs),
      ribbonData: {
        timePoints: samples.timePoints,
        questionsRibbon: samples.questionsRibbon,
        commitsRibbon: samples.commitsRibbon,
        studentCommitsPoints: ribbonPoints,
      },
      studentsActivity,
    };
  }
  /**
   * Derives the actionable "live cockpit" indicators from the already-computed detailed stats.
   * Pure and cheap (no extra data pass): the teacher gets who needs help, the class pace and the
   * latest activity. `nowMs` comes from ClockService so the dev-bar clock shift is honoured.
   */
  buildLiveIndicators(stats: SessionDetailedStats, nowMs: number): SessionLiveIndicators {
    const staleMs = this.LIVE_STALE_MINUTES * 60 * 1000;
    const startMs = new Date(stats.session.startDate).getTime();
    const questionsSummary = stats.questionsSummary || [];

    const health = classifyStudentHealth(stats.studentsActivity || [], startMs, nowMs, staleMs);

    /* Only the commits that already happened count: the session window extends into the future. */
    const points = (stats.ribbonData?.studentCommitsPoints || []).filter((point) => point.time.getTime() <= nowMs);
    const resolvedQuestionsList = resolveQuestionsFromPoints(
      points,
      questionsSummary.map((question) => question.question),
    );

    return {
      activeCount: health.activeCount,
      watchCount: health.watchCount,
      inactiveCount: health.inactiveCount,
      totalStudents: stats.totalEligibleStudents,
      resolvedQuestions: resolvedQuestionsList.length,
      totalQuestions: questionsSummary.length,
      questionsPct: questionsSummary.length > 0 ? Math.round((resolvedQuestionsList.length / questionsSummary.length) * 100) : 0,
      activeStudents: health.activeStudents,
      watchStudents: health.watchStudents,
      inactiveStudents: health.inactiveStudents,
      resolvedQuestionsList,
      resolvedChart: buildResolvedChart(points, stats.ribbonData?.questionsRibbon || [], startMs, nowMs, questionsSummary.length),
      watchlist: health.watchCandidates.slice(0, this.LIVE_WATCHLIST_LIMIT),
      pace: buildPace(points, stats.histogramBuckets || [], startMs, nowMs, staleMs),
      feed: buildLiveFeed(points, nowMs, this.LIVE_FEED_LIMIT),
    };
  }

  /**
   * Detects suggested sessions from commit clusters across all repositories
   */
  detectSuggestedSessions(
    repositories: Repository[],
    defaultDurationMinutes = 120,
    existingSessions: Session[] = [],
  ): SuggestedSessionResult[] {
    if (!repositories || repositories.length === 0) return [];

    // Group repos by tpGroup
    const groupsMap = new Map<string, Repository[]>();
    repositories.forEach((repo) => {
      const grp = repo.tpGroup || "";
      const existing = groupsMap.get(grp);
      if (existing) {
        existing.push(repo);
      } else {
        groupsMap.set(grp, [repo]);
      }
    });

    const suggestions: SuggestedSessionResult[] = [];

    groupsMap.forEach((reposInGroup, groupName) => {
      const allCommits: Array<{ commit: Commit; author: string }> = [];
      reposInGroup.forEach((r) => {
        r.commits?.forEach((c) => {
          allCommits.push({ commit: c, author: r.name || c.author });
        });
      });

      if (allCommits.length < 3) return;

      allCommits.sort((a, b) => new Date(a.commit.commitDate).getTime() - new Date(b.commit.commitDate).getTime());

      // Count existing sessions for this group
      const existingForGroup = (existingSessions || []).filter((s) => (s.tpGroup || "") === (groupName || "")).length;
      let groupSessionCounter = existingForGroup;

      // 15-minute slot aggregation
      const slotMap = new Map<number, Set<string>>();
      const slotCommitCount = new Map<number, number>();

      allCommits.forEach(({ commit, author }) => {
        const t = new Date(commit.commitDate).getTime();
        // Round to nearest 15 min
        const slotKey = Math.floor(t / (15 * 60 * 1000)) * (15 * 60 * 1000);
        if (!slotMap.has(slotKey)) {
          slotMap.set(slotKey, new Set());
          slotCommitCount.set(slotKey, 0);
        }
        const studentsSet = slotMap.get(slotKey);
        if (studentsSet) {
          studentsSet.add(author);
        }
        const currentCount = slotCommitCount.get(slotKey) || 0;
        slotCommitCount.set(slotKey, currentCount + 1);
      });

      // Identify slots where at least 2 distinct students (or 20% of group) were active
      const minActive = Math.max(2, Math.floor(reposInGroup.length * 0.2));
      const activeSlots = Array.from(slotMap.keys())
        .filter((slotKey) => (slotMap.get(slotKey)?.size || 0) >= minActive)
        .sort((a, b) => a - b);

      if (activeSlots.length === 0) return;

      // Cluster adjacent active slots (separated by no more than 45 min)
      const clusters: number[][] = [];
      let currentCluster: number[] = [activeSlots[0]];

      for (let i = 1; i < activeSlots.length; i++) {
        const prev = activeSlots[i - 1];
        const curr = activeSlots[i];
        if (curr - prev <= 45 * 60 * 1000) {
          currentCluster.push(curr);
        } else {
          clusters.push(currentCluster);
          currentCluster = [curr];
        }
      }
      if (currentCluster.length > 0) clusters.push(currentCluster);

      // Build session from each cluster
      clusters.forEach((cluster) => {
        const clusterStart = cluster[0];
        const clusterEnd = cluster[cluster.length - 1] + 15 * 60 * 1000;
        const clusterDurationMin = (clusterEnd - clusterStart) / 60000;

        // Use default duration if cluster is around that size, or adapt if clearly longer
        const durationToUseMin =
          clusterDurationMin > defaultDurationMinutes + 30 ? Math.round(clusterDurationMin / 30) * 30 : defaultDurationMinutes;

        const startDate = new Date(clusterStart);
        const endDate = new Date(clusterStart + durationToUseMin * 60 * 1000);

        // Check if overlaps with an existing session in the same group
        const overlapsExisting = (existingSessions || []).some((es) => {
          if ((es.tpGroup || "") !== (groupName || "")) return false;
          const esStart = new Date(es.startDate).getTime();
          const esEnd = new Date(es.endDate).getTime();
          return Math.max(startDate.getTime(), esStart) < Math.min(endDate.getTime(), esEnd);
        });
        if (overlapsExisting) return;

        // Count distinct students and commits in this detected window
        const windowCommits = allCommits.filter(({ commit }) => {
          const ct = new Date(commit.commitDate).getTime();
          return ct >= startDate.getTime() && ct <= endDate.getTime();
        });

        const distinctStudents = new Set(windowCommits.map((w) => w.author));

        if (distinctStudents.size >= minActive && windowCommits.length >= 4) {
          groupSessionCounter++;
          const suggestedLabel = `Séance ${groupSessionCounter}`;

          // Note: session.label is intentionally undefined so the application's default dynamic label mechanism works
          const session = new Session(startDate, endDate, groupName || undefined, undefined, undefined);

          suggestions.push({
            session,
            activeStudentsCount: distinctStudents.size,
            commitsCount: windowCommits.length,
            totalGroupStudents: reposInGroup.length,
            suggestedLabel,
          });
        }
      });
    });

    return suggestions.sort((a, b) => a.session.startDate.getTime() - b.session.startDate.getTime());
  }
}
