import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { Router } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import * as moment from "moment";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

import { Session } from "@models/Session.model";
import { Repository } from "@models/Repository.model";
import { AssignmentsService } from "@services/assignments.service";

import { buildArea, buildListTooltip, buildPolyline, formatCountdown, formatDateLabel, formatDuration } from "./session-tab-format.util";
import { pickDefaultSession, publishRailMetrics, sessionWindow } from "./session-tab-layout.util";
import { ClockService, MINUTE_MS } from "@services/clock.service";
import { DataService } from "@services/data.service";
import { DatabaseService } from "@services/database.service";
import { LoaderService } from "@services/loader.service";
import { OverlayManagerService, OverlayType } from "@services/overlay-manager.service";
import { SessionAnalyticsService, SessionDetailedStats, SessionLiveIndicators } from "@services/session-analytics.service";
import { getSessionDisplayName } from "@services/session-label.util";
import { ToastService } from "@services/toast.service";
import { CustomModalService } from "@shared/ui/custom-modal/custom-modal.service";
import { EditSessionComponent } from "@components/edit-session/edit-session.component";

interface SessionTabView {
  session: Session;
  state: "in-progress" | "upcoming";
  /** Pre-formatted remaining time, e.g. "2:34" or "1:23:45". */
  countdown: string;
  /** 0..1 progress through the session (0 when upcoming). */
  progress: number;
  label: string;
  dateLabel: string;
  timeRange: string;
  durationLabel: string;
  tpGroup: string | null;
  notes: string | null;
  /** Actionable live indicators, null until the stats are computed (panel open). */
  live: SessionLiveIndicators | null;
  /** True while a session is running: the data is refreshed automatically. */
  autoRefresh: boolean;
  /** Session switcher state; null when there is at most one eligible session. */
  nav: { canPrev: boolean; canNext: boolean; index: number; total: number } | null;
  /** HTML tooltips for the health counts and the resolved-questions metric. */
  tooltips: { active: string; watch: string; inactive: string; questions: string } | null;
  /** Resolved-questions scatter: one dot per completion, plus the group average curve (line + area). */
  resolvedDots: Array<{ x: number; y: number; question: string; student: string; minutesAgo: number }>;
  resolvedAveragePoints: string;
  resolvedAverageArea: string;
  timelineStart: string;
  timelineNow: string;
  open: boolean;
}

/** Must stay in sync with $transition-tab-swap (the counter is frozen for this long). */
const SWAP_MS = 450;

/**
 * The counter switches to the running value part-way through the swap rather than at the end,
 * so its growth lands while the counter is still moving and the change is masked by the motion.
 * The easing spends most of the travel in the first ~100ms, so this has to be early to have any
 * movement left to hide behind.
 */
const COUNTDOWN_RELEASE_RATIO = 0.15;

/** Data refresh cadence while a session is running (auto, even with the panel closed). */
const AUTO_REFRESH_MS = 3 * MINUTE_MS;

/**
 * Folder tab pinned to the right edge, shown as soon as the closest session is running or
 * starts within 5 minutes. Hovering peeks the panel out by 20px, clicking opens it fully.
 * Mounted inside the assignment layout, so it never shows on the assignment list.
 */
@Component({
    selector: "app-session-tab",
    templateUrl: "./session-tab.component.html",
    styleUrls: ["./session-tab.component.scss"],
    standalone: false
})
export class SessionTabComponent implements OnInit, OnDestroy {
  readonly upcomingWindowMs = 5 * MINUTE_MS;

  view: SessionTabView | null = null;
  hovered = false;
  /** True while a manual/auto refresh is in flight (drives the spinner). */
  refreshing = false;
  /** Student whose commit trajectory is highlighted on the resolved-questions chart. */
  hoveredStudent: string | null = null;
  hoveredTrajectory = "";

  private session: Session | null = null;
  private state: "in-progress" | "upcoming" = "upcoming";
  /** All currently eligible sessions (running, else upcoming), chronological order. */
  private eligibleSessions: Session[] = [];
  /** Key of the user's selected session, kept across the 1s ticks. */
  private selectedKey = "";
  private stats: SessionDetailedStats | null = null;
  private statsCacheKey = "";
  private open = false;
  private now = Date.now();
  private tickId: any = null;
  private autoRefreshId: any = null;
  private destroy$ = new Subject<void>();

  /* The live indicators only move once a minute (relative times) or when the stats change:
     caching keeps the *ngFor lists identity-stable across the 1s ticks. */
  private liveCache: SessionLiveIndicators | null = null;
  private liveCacheStats: SessionDetailedStats | null = null;
  private liveCacheMinute = -1;

  /** While the swap plays, the counter is held at zero instead of jumping to the session length. */
  private countdownHold: string | null = null;
  private holdTimer: any = null;

  private railEl: HTMLElement | null = null;
  private railObserver: any = null;
  private measureRafId: number | null = null;

  constructor(
    private router: Router,
    private clockService: ClockService,
    public dataService: DataService,
    private databaseService: DatabaseService,
    private assignmentsService: AssignmentsService,
    private overlayManagerService: OverlayManagerService,
    private sessionAnalyticsService: SessionAnalyticsService,
    private customModalService: CustomModalService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private loaderService: LoaderService,
  ) {}

  /** The rail only exists while a session is eligible, so wire the observer from the setter. */
  @ViewChild("rail")
  set railRef(ref: ElementRef<HTMLElement> | undefined) {
    this.railObserver?.disconnect();
    this.railObserver = null;
    this.railEl = ref?.nativeElement ?? null;
    const ObserverCtor = (window as any).ResizeObserver;
    if (!this.railEl || !ObserverCtor) {
      /* Without ResizeObserver the rail is still measured on every refresh tick */
      publishRailMetrics(this.railEl);
      this.scheduleMeasure();
      return;
    }
    this.railObserver = new ObserverCtor(() => this.scheduleMeasure());
    this.railObserver.observe(this.railEl);
    /* Measure synchronously so the first paint already has the final positions: otherwise the
       lines would slide in from zero on appearance. */
    publishRailMetrics(this.railEl);
    this.scheduleMeasure();
  }

  @HostListener("document:keydown.escape")
  onEscape(): void {
    this.closePanel();
  }

  ngOnInit(): void {
    /* Dismiss the panel when another overlay takes over (never for plain tooltips).
       Events that exclude SESSION_PANE (e.g. scrolling the graph) leave the panel open. */
    const closingTypes = [OverlayType.ALL, OverlayType.CONTEXT_MENU, OverlayType.DROPDOWN, OverlayType.QUICK_HELP];
    this.overlayManagerService.dismiss$.pipe(takeUntil(this.destroy$)).subscribe((event) => {
      if (!this.open || event.options?.exclude?.includes(OverlayType.SESSION_PANE)) {
        return;
      }
      if (closingTypes.some((type) => OverlayManagerService.shouldDismiss(type, event))) {
        this.closePanel();
      }
    });

    /* Re-evaluate immediately when the dev-bar clock is shifted */
    this.clockService.offsetMs$.pipe(takeUntil(this.destroy$)).subscribe(() => this.refreshNow());

    /* Commit data changed somewhere else: the stats may have moved */
    this.databaseService.dbChanged.pipe(takeUntil(this.destroy$)).subscribe(() => this.invalidateStats());
    this.assignmentsService.assignmentModified.pipe(takeUntil(this.destroy$)).subscribe(() => this.invalidateStats());

    /* Date wording follows the active language, and so do the swap distances (the labels
       change length). Re-measure once the DOM has re-rendered. */
    this.translateService.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.rebuildView();
      this.scheduleMeasure();
    });

    /* A session becomes eligible at start-5min and stops being eligible at its end */
    this.refreshNow();
    this.tickId = setInterval(() => this.refreshNow(), 1000);

    /* Keep the data fresh while a session is running, whether or not the panel is open */
    this.autoRefreshId = setInterval(() => this.autoRefreshTick(), AUTO_REFRESH_MS);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    clearInterval(this.tickId);
    clearInterval(this.autoRefreshId);
    clearTimeout(this.holdTimer);
    this.railObserver?.disconnect();
    if (this.measureRafId !== null) {
      cancelAnimationFrame(this.measureRafId);
      this.measureRafId = null;
    }
  }

  togglePanel(): void {
    if (this.open) {
      this.closePanel();
      return;
    }
    /* Dismiss other overlays FIRST: going through the dismiss stream after opening would
       make our own listener treat the panel as the overlay being replaced. */
    this.overlayManagerService.dismissTransient();
    this.open = true;
    this.ensureStats();
    this.rebuildView();
  }

  closePanel(): void {
    if (!this.open) {
      return;
    }
    this.open = false;
    /* Drop the hover peek so the close animates fully to the closed position in one motion:
       closing from the tab (pointer still over it) would otherwise stop at the peek offset. */
    this.hovered = false;
    this.rebuildView();
  }

  /** Pulls the latest commits from the provider (manual button or auto-refresh during a session). */
  refresh(): void {
    if (this.refreshing) {
      return;
    }
    this.refreshing = true;
    this.loaderService.loadRepositories(this.dataService.startDate, this.dataService.endDate).subscribe({
      error: () => {
        this.refreshing = false;
      },
      complete: () => {
        this.refreshing = false;
        this.invalidateStats();
      },
    });
  }

  openRepository(repository: Repository): void {
    if (repository?.url) {
      window.open(repository.url, "_blank");
    }
  }

  openCommit(url: string): void {
    if (url) {
      window.open(url, "_blank");
    }
  }

  /** Tooltip for a resolved-questions scatter dot: "iter 5 · Alice · 6 min ago". */
  dotTooltip(dot: { question: string; student: string; minutesAgo: number }): string {
    const ago =
      dot.minutesAgo < 1
        ? this.translateService.instant("SESSION-TAB.PANEL.FEED.JUST-NOW")
        : this.translateService.instant("SESSION-TAB.PANEL.FEED.MIN-AGO", { minutes: dot.minutesAgo });
    return `${dot.question} · ${dot.student} · ${ago}`;
  }

  /** Highlight the hovered student's commit trajectory on the chart (like the sessions ribbon). */
  onDotEnter(student: string): void {
    this.hoveredStudent = student;
    const trajectory = this.liveCache?.resolvedChart.trajectories?.[student];
    this.hoveredTrajectory = trajectory ? buildPolyline(trajectory) : "";
  }

  onDotLeave(): void {
    this.hoveredStudent = null;
    this.hoveredTrajectory = "";
  }

  selectPrev(): void {
    this.stepSelection(-1);
  }

  selectNext(): void {
    this.stepSelection(1);
  }

  onOpenMatrix(): void {
    const session = this.session;
    this.closePanel();
    if (!session) {
      this.router.navigate(["/sessions"]);
      return;
    }
    this.router.navigate(["/sessions"], {
      queryParams: { sub: "matrix", session: new Date(session.startDate).toISOString() },
    });
  }

  onViewInGraph(): void {
    const session = this.session;
    this.closePanel();
    if (!session) {
      return;
    }
    this.router.navigate(["/commits"]).then(() => {
      /* Let the graph mount/rebuild before asking it to zoom */
      requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent("git4school:zoom-to-session", { detail: { session } }));
      });
    });
  }

  onEditSession(): void {
    const session = this.session;
    if (!session) {
      return;
    }
    const modalRef = this.customModalService.open(EditSessionComponent, {});
    modalRef.componentInstance.session = session;
    modalRef.componentInstance.addMode = false;
    /* The modal takes over the screen: don't leave the panel open behind it */
    this.closePanel();

    modalRef.result
      .then((result: any) => {
        const sessions = this.dataService.sessions || [];
        const index = sessions.indexOf(session);
        if (result && result.deleted) {
          if (index >= 0) {
            sessions.splice(index, 1);
          }
          this.saveAndNotify();
          this.invalidateStats();
          return;
        }
        if (!result) {
          return;
        }
        if (index >= 0) {
          sessions[index] = result;
        }
        this.saveAndNotify();
        this.session = result;
        this.invalidateStats();
        this.toastService.success(
          this.translateService.instant("SUCCESS"),
          this.translateService.instant("SESSION-TAB.PANEL.UPDATED-TOAST"),
        );
      })
      .catch(() => {});
  }

  private refreshNow(): void {
    this.now = this.clockService.now().getTime();
    const list = this.resolveEligibleSessions();
    this.eligibleSessions = list;

    /* Keep the user's selected session across ticks; fall back to the default when it is gone. */
    let selected = list.find((s) => this.sessionKey(s) === this.selectedKey) || null;
    if (!selected && list.length) {
      selected = pickDefaultSession(list, this.now);
      this.selectedKey = selected ? this.sessionKey(selected) : "";
    }
    if (!selected) {
      this.selectedKey = "";
    }

    const changed = this.sessionKey(selected) !== this.sessionKey(this.session);
    const wasUpcoming = this.state === "upcoming";
    const state: "in-progress" | "upcoming" = selected && this.isInProgress(selected) ? "in-progress" : "upcoming";

    /* The same session just started: the counter holds at zero while the swap plays, instead of
       jumping straight to the whole session length. */
    if (!changed && wasUpcoming && state === "in-progress") {
      this.holdCountdown();
    } else if (changed || state === "upcoming") {
      this.clearCountdownHold();
    }

    this.session = selected;
    this.state = state;

    if (!selected || changed) {
      /* No session, or a different one took over: stale stats and an open panel are meaningless */
      this.stats = null;
      this.statsCacheKey = "";
      this.open = false;
    } else if (this.open) {
      this.ensureStats();
    }

    this.rebuildView();
    /* The texts may have changed length (the counter loses a digit, the wording changes) */
    this.scheduleMeasure();
  }

  /** Switches to the previous/next eligible session without closing the panel. */
  private stepSelection(delta: number): void {
    const list = this.eligibleSessions;
    if (list.length < 2) {
      return;
    }
    const current = list.findIndex((s) => this.sessionKey(s) === this.selectedKey);
    const next = (current < 0 ? 0 : current) + delta;
    if (next < 0 || next >= list.length) {
      return;
    }
    this.applySelection(list[next]);
  }

  /** Applies a manual session switch: recompute the stats, keep the panel open. */
  private applySelection(session: Session): void {
    this.selectedKey = this.sessionKey(session);
    this.session = session;
    this.state = this.isInProgress(session) ? "in-progress" : "upcoming";
    this.clearCountdownHold();
    this.ensureStats();
    this.rebuildView();
    this.scheduleMeasure();
    /* Focus the newly selected session in the graph (handled by the commits/sessions views). */
    window.dispatchEvent(new CustomEvent("git4school:focus-session", { detail: { session } }));
  }

  /** Le créneau de la séance contient-il l'instant courant ? */
  private isInProgress(session: Session): boolean {
    const { start, end } = sessionWindow(session);
    return this.now >= start && this.now <= end;
  }

  private rebuildView(): void {
    const session = this.session;
    if (!session) {
      this.view = null;
      return;
    }
    const now = this.now;
    const { start, end } = sessionWindow(session);
    const inProgress = this.state === "in-progress";
    const remaining = inProgress ? end - now : start - now;

    const list = this.eligibleSessions;
    const index = list.findIndex((s) => this.sessionKey(s) === this.selectedKey);
    const nav =
      list.length > 1 ? { canPrev: index > 0, canNext: index >= 0 && index < list.length - 1, index: index + 1, total: list.length } : null;
    const live = this.buildLive();

    this.view = {
      session,
      state: this.state,
      countdown: this.countdownHold ?? formatCountdown(remaining),
      progress: inProgress ? this.clamp01((now - start) / Math.max(1, end - start)) : 0,
      label: getSessionDisplayName(session, this.dataService.sessions || [], this.translateService),
      dateLabel: formatDateLabel(start, this.translateService.currentLang),
      timeRange: `${moment(start).format("HH:mm")} – ${moment(end).format("HH:mm")}`,
      durationLabel: formatDuration(end - start),
      tpGroup: session.tpGroup || null,
      notes: session.notes && session.notes.trim() ? session.notes : null,
      live,
      autoRefresh: this.state === "in-progress",
      nav,
      tooltips: live
        ? {
            active: this.buildHealthListTooltip("SESSION-TAB.PANEL.HEALTH.ACTIVE-LIST", live.activeStudents),
            watch: this.buildHealthListTooltip("SESSION-TAB.PANEL.HEALTH.WATCH-LIST", live.watchStudents),
            inactive: this.buildHealthListTooltip("SESSION-TAB.PANEL.HEALTH.INACTIVE-LIST", live.inactiveStudents),
            questions: this.buildHealthListTooltip("SESSION-TAB.PANEL.HEALTH.QUESTIONS-LIST", live.resolvedQuestionsList),
          }
        : null,
      resolvedDots: live ? live.resolvedChart.dots : [],
      resolvedAveragePoints: live ? buildPolyline(live.resolvedChart.average) : "",
      resolvedAverageArea: live ? buildArea(live.resolvedChart.average) : "",
      timelineStart: moment(start).format("HH:mm"),
      timelineNow: moment(now).format("HH:mm"),
      open: this.open,
    };
  }

  /** Live indicators, cached per stats reference and per minute (relative times only move that often). */
  /** HTML list tooltip of a health bucket, with its translated labels. */
  private buildHealthListTooltip(titleKey: string, items: string[]): string {
    return buildListTooltip(this.translateService.instant(titleKey), this.translateService.instant("SESSION-TAB.PANEL.HEALTH.NONE"), items);
  }

  private buildLive(): SessionLiveIndicators | null {
    if (!this.open || !this.stats) {
      this.liveCache = null;
      this.liveCacheStats = null;
      this.liveCacheMinute = -1;
      return null;
    }
    const minute = Math.floor(this.now / MINUTE_MS);
    if (this.liveCache && this.liveCacheStats === this.stats && this.liveCacheMinute === minute) {
      return this.liveCache;
    }
    this.liveCacheStats = this.stats;
    this.liveCacheMinute = minute;
    this.liveCache = this.sessionAnalyticsService.buildLiveIndicators(this.stats, this.now);
    return this.liveCache;
  }

  private holdCountdown(): void {
    this.countdownHold = "0:00";
    clearTimeout(this.holdTimer);
    this.holdTimer = setTimeout(() => {
      this.holdTimer = null;
      this.countdownHold = null;
      this.rebuildView();
      this.scheduleMeasure();
    }, SWAP_MS * COUNTDOWN_RELEASE_RATIO);
  }

  private clearCountdownHold(): void {
    clearTimeout(this.holdTimer);
    this.holdTimer = null;
    this.countdownHold = null;
  }

  /** Remeasure once the DOM has caught up with the latest view (the counter's text length varies). */
  private scheduleMeasure(): void {
    if (this.measureRafId !== null) {
      return;
    }
    this.measureRafId = requestAnimationFrame(() => {
      this.measureRafId = null;
      publishRailMetrics(this.railEl);
    });
  }

  /**
   * Stats are expensive (histogram + ribbon + per-student activity), so they are computed
   * only while the panel is open and cached until the commit data changes.
   */
  private ensureStats(): void {
    const session = this.session;
    if (!session) {
      return;
    }
    const key = this.sessionKey(session);
    if (this.statsCacheKey === key) {
      return;
    }
    this.statsCacheKey = key;
    try {
      this.stats = this.sessionAnalyticsService.computeSessionStats(
        session,
        this.dataService.repositories || [],
        this.dataService.questions || [],
      );
    } catch (e) {
      this.stats = null;
    }
  }

  private invalidateStats(): void {
    this.stats = null;
    this.statsCacheKey = "";
    this.refreshNow();
  }

  /** Auto-refresh only while a session is actually running (panel open or not). */
  private autoRefreshTick(): void {
    if (this.state === "in-progress" && !this.refreshing) {
      this.refresh();
    }
  }

  /** Running sessions (chronological order), else the soonest upcoming ones. */
  private resolveEligibleSessions(): Session[] {
    const now = this.now;
    const sessions = (this.dataService.sessions || []).filter(
      (s) =>
        !!s && !!s.startDate && !!s.endDate && (!this.dataService.groupFilter || !s.tpGroup || s.tpGroup === this.dataService.groupFilter),
    );

    const running: Session[] = [];
    const upcoming: Session[] = [];
    for (const session of sessions) {
      const { start, end } = sessionWindow(session);
      if (now >= start && now <= end) {
        running.push(session);
      } else if (start > now && start - now <= this.upcomingWindowMs) {
        upcoming.push(session);
      }
    }

    running.sort((a, b) => sessionWindow(a).start - sessionWindow(b).start);
    upcoming.sort((a, b) => sessionWindow(a).start - sessionWindow(b).start);
    return running.length ? running : upcoming;
  }

  private sessionKey(session: Session | null): string {
    if (!session) {
      return "";
    }
    const { start, end } = sessionWindow(session);
    return `${start}|${end}|${session.tpGroup || ""}|${session.label || ""}`;
  }

  private clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
  }

  private saveAndNotify(): void {
    if (this.dataService.assignment) {
      this.databaseService.saveAssignment(this.dataService.assignment);
      this.assignmentsService.assignmentModified.next();
    }
  }
}
