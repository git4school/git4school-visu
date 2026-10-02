import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { Router } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import * as moment from "moment";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

import { Session } from "@models/Session.model";
import { AssignmentsService } from "@services/assignments.service";
import { ClockService, MINUTE_MS } from "@services/clock.service";
import { DataService } from "@services/data.service";
import { DatabaseService } from "@services/database.service";
import { OverlayManagerService, OverlayType } from "@services/overlay-manager.service";
import { SessionAnalyticsService, SessionDetailedStats } from "@services/session-analytics.service";
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
  stats: {
    activeStudentsCount: number;
    totalEligibleStudents: number;
    inSessionCommitsCount: number;
    resolvedQuestionsCount: number;
    participationRate: number;
  } | null;
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

/**
 * Folder tab pinned to the right edge, shown as soon as the closest session is running or
 * starts within 5 minutes. Hovering peeks the panel out by 20px, clicking opens it fully.
 * Mounted inside the assignment layout, so it never shows on the assignment list.
 */
@Component({
  selector: "app-session-tab",
  templateUrl: "./session-tab.component.html",
  styleUrls: ["./session-tab.component.scss"],
})
export class SessionTabComponent implements OnInit, OnDestroy {
  readonly upcomingWindowMs = 5 * MINUTE_MS;

  view: SessionTabView | null = null;
  hovered = false;

  private session: Session | null = null;
  private state: "in-progress" | "upcoming" = "upcoming";
  private stats: SessionDetailedStats | null = null;
  private statsCacheKey = "";
  private open = false;
  private now = Date.now();
  private tickId: any = null;
  private destroy$ = new Subject<void>();

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
      this.measureRail();
      this.scheduleMeasure();
      return;
    }
    this.railObserver = new ObserverCtor(() => this.scheduleMeasure());
    this.railObserver.observe(this.railEl);
    /* Measure synchronously so the first paint already has the final positions: otherwise the
       lines would slide in from zero on appearance. */
    this.measureRail();
    this.scheduleMeasure();
  }

  @HostListener("document:keydown.escape")
  onEscape(): void {
    this.closePanel();
  }

  ngOnInit(): void {
    /* Dismiss the panel when another overlay takes over (never for plain tooltips) */
    const closingTypes = [OverlayType.ALL, OverlayType.CONTEXT_MENU, OverlayType.DROPDOWN, OverlayType.QUICK_HELP];
    this.overlayManagerService.dismiss$.pipe(takeUntil(this.destroy$)).subscribe((event) => {
      if (this.open && closingTypes.some((type) => OverlayManagerService.shouldDismiss(type, event))) {
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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    clearInterval(this.tickId);
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
    this.rebuildView();
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
    const eligible = this.resolveEligibleSession();
    const changed = this.sessionKey(eligible) !== this.sessionKey(this.session);
    const wasUpcoming = this.state === "upcoming";
    const state: "in-progress" | "upcoming" =
      eligible && this.now >= this.startMs(eligible) && this.now <= this.endMs(eligible) ? "in-progress" : "upcoming";

    /* The same session just started: the counter holds at zero while the swap plays, instead of
       jumping straight to the whole session length. */
    if (!changed && wasUpcoming && state === "in-progress") {
      this.holdCountdown();
    } else if (changed || state === "upcoming") {
      this.clearCountdownHold();
    }

    this.session = eligible;
    this.state = state;

    if (!eligible || changed) {
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

  private rebuildView(): void {
    const session = this.session;
    if (!session) {
      this.view = null;
      return;
    }
    const now = this.now;
    const start = this.startMs(session);
    const end = this.endMs(session);
    const inProgress = this.state === "in-progress";
    const remaining = inProgress ? end - now : start - now;

    this.view = {
      session,
      state: this.state,
      countdown: this.countdownHold ?? this.formatCountdown(remaining),
      progress: inProgress ? this.clamp01((now - start) / Math.max(1, end - start)) : 0,
      label: session.label && session.label.trim() ? session.label : this.translateService.instant("SESSION-TAB.TAB.LABEL-FALLBACK"),
      dateLabel: this.formatDateLabel(start),
      timeRange: `${moment(start).format("HH:mm")} – ${moment(end).format("HH:mm")}`,
      durationLabel: this.formatDuration(end - start),
      tpGroup: session.tpGroup || null,
      notes: session.notes && session.notes.trim() ? session.notes : null,
      stats: this.stats
        ? {
            activeStudentsCount: this.stats.activeStudentsCount,
            totalEligibleStudents: this.stats.totalEligibleStudents,
            inSessionCommitsCount: this.stats.inSessionCommitsCount,
            resolvedQuestionsCount: this.stats.resolvedQuestionsCount,
            participationRate: Math.round(this.stats.participationRate),
          }
        : null,
      open: this.open,
    };
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

  /**
   * Publishes the three swap distances as CSS custom properties on the rail.
   * They depend on the text lengths, which CSS cannot read, so they come from the DOM.
   * offsetHeight is layout-only, so a transform in flight does not corrupt the reading.
   */
  private measureRail(): void {
    const rail = this.railEl;
    if (!rail) {
      return;
    }
    const counter = rail.querySelector<HTMLElement>(".peek-counter__text");
    const incoming = rail.querySelector<HTMLElement>(".peek-line--in");
    const outgoing = rail.querySelector<HTMLElement>(".peek-line--out");
    if (!counter || !incoming || !outgoing) {
      return;
    }
    const railHeight = rail.clientHeight;
    const counterHeight = counter.offsetHeight;
    const incomingHeight = incoming.offsetHeight;
    const outgoingHeight = outgoing.offsetHeight;
    if (!railHeight || !counterHeight || !incomingHeight || !outgoingHeight) {
      return;
    }

    /* The counter's gap is the shared travel: the labels ride along with it so the three lines
       stay in lockstep. The flush positions are the rail's height minus each text's own length. */
    const travel = Math.max(0, railHeight - counterHeight);
    rail.style.setProperty("--travel", `${travel}px`);
    /* The outgoing label sits flush at the bottom, and its length differs from the incoming one */
    rail.style.setProperty("--out-bottom", `${Math.max(0, railHeight - outgoingHeight)}px`);
    /* Enough to start fully hidden even when the text is longer than the gap */
    rail.style.setProperty("--in-enter", `${Math.max(travel, incomingHeight)}px`);
  }

  /** Remeasure once the DOM has caught up with the latest view (the counter's text length varies). */
  private scheduleMeasure(): void {
    if (this.measureRafId !== null) {
      return;
    }
    this.measureRafId = requestAnimationFrame(() => {
      this.measureRafId = null;
      this.measureRail();
    });
  }

  private formatDateLabel(ms: number): string {
    moment.locale(this.translateService.currentLang || "en");
    return moment(ms).format("dddd D MMMM");
  }

  /** "1h30" / "45 min" */
  private formatDuration(ms: number): string {
    const totalMinutes = Math.max(0, Math.round(ms / MINUTE_MS));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours && minutes) {
      return `${hours}h${String(minutes).padStart(2, "0")}`;
    }
    return hours ? `${hours}h` : `${minutes} min`;
  }

  /** "2:34" under an hour, "1:23:45" above. Language-neutral on purpose. */
  private formatCountdown(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    const hours = Math.floor(total / 3600);
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
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

  /** In-progress sessions win; among them the most recently started. Otherwise the soonest upcoming. */
  private resolveEligibleSession(): Session | null {
    const now = this.now;
    const sessions = (this.dataService.sessions || []).filter(
      (s) =>
        !!s && !!s.startDate && !!s.endDate && (!this.dataService.groupFilter || !s.tpGroup || s.tpGroup === this.dataService.groupFilter),
    );

    const running: Session[] = [];
    const upcoming: Session[] = [];
    for (const session of sessions) {
      const start = this.startMs(session);
      if (now >= start && now <= this.endMs(session)) {
        running.push(session);
      } else if (start > now && start - now <= this.upcomingWindowMs) {
        upcoming.push(session);
      }
    }

    if (running.length) {
      return running.reduce((a, b) => (this.startMs(b) >= this.startMs(a) ? b : a));
    }
    if (upcoming.length) {
      return upcoming.reduce((a, b) => (this.startMs(b) <= this.startMs(a) ? b : a));
    }
    return null;
  }

  private startMs(session: Session): number {
    return this.toMs(session.startDate);
  }

  private endMs(session: Session): number {
    const start = this.startMs(session);
    const end = this.toMs(session.endDate);
    /* Sessions may wrap around midnight (see EditSessionComponent) */
    return end < start ? end + 24 * 60 * MINUTE_MS : end;
  }

  private toMs(value: Date): number {
    return value instanceof Date ? value.getTime() : new Date(value).getTime();
  }

  private sessionKey(session: Session | null): string {
    if (!session) {
      return "";
    }
    return `${this.startMs(session)}|${this.endMs(session)}|${session.tpGroup || ""}|${session.label || ""}`;
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
