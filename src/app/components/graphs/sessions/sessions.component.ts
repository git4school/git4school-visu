import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
} from "@angular/core";
import { CommitColor } from "@models/Commit.model";
import { Repository } from "@models/Repository.model";
import { Session } from "@models/Session.model";
import { ActivatedRoute } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import { AssignmentsService } from "@services/assignments.service";
import { ClockService } from "@services/clock.service";
import { AnonymizationService } from "@services/anonymization.service";
import { DataService } from "@services/data.service";
import { LoaderService } from "@services/loader.service";
import { SessionAnalyticsService, SessionDetailedStats, StudentSessionActivity } from "@services/session-analytics.service";
import { SessionRibbonChartRenderer, TrajectoryWarmState } from "./sessions-ribbon-chart.renderer";
import { SessionMacroChartsRenderer } from "./sessions-macro-charts.renderer";
import { findDeepLinkSessionIndex, parseSessionsDeepLink, SessionsDeepLink } from "./sessions-deep-link.util";
import { buildMacroStats, buildResolvedQuestionsTooltip, filterSessionStats, filterStudentActivity } from "./sessions-analytics.util";
import { getSessionDisplayName } from "@services/session-label.util";
import { ThemeService } from "@services/theme.service";
import { ToastService } from "@services/toast.service";
import { TooltipService } from "@services/tooltip.service";
import { DatabaseService } from "@services/database.service";

import { CustomModalService } from "@shared/ui/custom-modal/custom-modal.service";
import { EditSessionComponent } from "@components/edit-session/edit-session.component";
import { SuggestSessionsModalComponent } from "./suggest-sessions-modal/suggest-sessions-modal.component";
import { BaseGraphComponent } from "../base-graph.component";

import { Subscription } from "rxjs";

export interface MacroSessionOverview {
  totalSessionsCount: number;
  averageParticipationRate: number;
  totalInSessionCommits: number;
  totalOutOfSessionCommits: number;
  inSessionRatio: number;
  outOfSessionRatio: number;
  totalHoursSupervised: string;
  questionsResolvedCount: number;
  resolvedQuestions: string[];
  totalQuestionsCount: number;
  sessionsStats: SessionDetailedStats[];
}

@Component({
  selector: "app-sessions",
  templateUrl: "./sessions.component.html",
  styleUrls: ["./sessions.component.scss"],
})
export class SessionsComponent extends BaseGraphComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild("ribbonChartContainer") ribbonChartContainer?: ElementRef;
  @ViewChild("histogramChartContainer") histogramChartContainer?: ElementRef;
  @ViewChild("comparisonChartContainer") comparisonChartContainer?: ElementRef;
  @ViewChild("macroChartScroller") macroChartScroller?: ElementRef<HTMLDivElement>;
  @ViewChild("ribbonBar") ribbonBar?: ElementRef<HTMLDivElement>;
  @ViewChild("d3TooltipTemplate") d3TooltipTemplate!: TemplateRef<any>;

  selectedSessionIndex = -1; // -1 for Macro "Toutes les séances"
  displayMode: "questions" | "commits" = "questions";
  /** Warm-up du tracé de trajectoire (voir SessionRibbonChartRenderer). */
  readonly trajectoryWarm = new TrajectoryWarmState();
  studentFilter: "all" | "active" | "inactive" = "all";
  activeSubTab: "timeline" | "matrix" | "students" = "timeline";

  isCalculating = false;
  calcProgress = 0;
  canScrollLeft = false;
  canScrollRight = false;

  sessionStatsList: SessionDetailedStats[] = [];
  macroStats: MacroSessionOverview | null = null;

  readonly commitColors = [CommitColor.INTERMEDIATE, CommitColor.BEFORE, CommitColor.BETWEEN, CommitColor.AFTER];
  assignmentsModified$?: Subscription;
  groupFilterSub?: Subscription;
  private viewResizeObserver?: any;
  private sessionToCenter?: Session;
  /** Deep-link target from the session panel ("Voir tout"): session start + sub-tab to open. */
  private pendingDeepLink?: SessionsDeepLink;

  constructor(
    public dataService: DataService,
    public translateService: TranslateService,
    public themeService: ThemeService,
    protected loaderService: LoaderService,
    protected assignmentsService: AssignmentsService,
    private sessionAnalyticsService: SessionAnalyticsService,
    public tooltipService: TooltipService,
    private toastService: ToastService,
    private customModalService: CustomModalService,
    private databaseService: DatabaseService,
    private cdr: ChangeDetectorRef,
    private clockService: ClockService,
    private route: ActivatedRoute,
    public anonymizationService: AnonymizationService,
  ) {
    super(loaderService, assignmentsService, dataService, translateService, anonymizationService);
  }

  @HostListener("window:keydown", ["$event"])
  onKeyDown(event: KeyboardEvent): void {
    // Ignore when typing in inputs
    const target = event.target as HTMLElement;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
      return;
    }

    const filteredSessions = this.getFilteredSessions();
    if (filteredSessions.length === 0) return;

    if (event.key === "ArrowRight" && event.altKey) {
      // Next session
      if (this.selectedSessionIndex < filteredSessions.length - 1) {
        this.selectSession(this.selectedSessionIndex + 1);
      }
    } else if (event.key === "ArrowLeft" && event.altKey) {
      // Previous session
      if (this.selectedSessionIndex > -1) {
        this.selectSession(this.selectedSessionIndex - 1);
      }
    } else if (event.key === "0" && !event.ctrlKey && !event.metaKey) {
      this.selectSession(-1);
    }
  }

  /** Session panel switcher: select and center the matching session in the ribbon. */
  @HostListener("window:git4school:focus-session", ["$event"])
  onFocusSession(event: CustomEvent): void {
    const session = (event as CustomEvent)?.detail?.session as Session;
    if (!session) {
      return;
    }
    const startMs = new Date(session.startDate).getTime();
    const filtered = this.getFilteredSessions();
    const idx = filtered.findIndex((stat) => new Date(stat.session.startDate).getTime() === startMs);
    if (idx < 0) {
      return;
    }
    this.selectedSessionIndex = idx;
    this.safeDetectChanges();
    setTimeout(() => {
      this.renderCurrentCharts();
      this.scrollSelectedPillIntoView(idx);
    }, 50);
  }

  ngOnInit(): void {
    this.readDeepLink();
    this.startGraphView({
      refresh: () => this.loadGraphDataAndRefresh(),
      draw: () => {
        this.renderCurrentCharts();
        this.updateRibbonNavButtons();
      },
      hasData: () => this.sessionStatsList && this.sessionStatsList.length > 0,
      observe: () => this.ribbonChartContainer,
    });
  }

  ngAfterViewInit(): void {
    this.viewResizeObserver = new (window as any).ResizeObserver(() => {
      this.renderCurrentCharts();
      this.updateRibbonNavButtons();
    });

    const checkAndObserve = () => {
      const ribbonEl = this.ribbonChartContainer?.nativeElement;
      // Observe the scroll wrapper, not the chart itself: the chart width is driven by its content.
      const macroWrapper = this.macroChartScroller?.nativeElement;
      if (ribbonEl) {
        this.viewResizeObserver.observe(ribbonEl);
      }
      if (macroWrapper) {
        this.viewResizeObserver.observe(macroWrapper);
      }
      if (this.ribbonBar?.nativeElement) {
        this.viewResizeObserver.observe(this.ribbonBar.nativeElement);
        this.updateRibbonNavButtons();
      }
    };

    setTimeout(checkAndObserve, 100);
  }

  ngOnDestroy(): void {
    if (this.assignmentsModified$) {
      this.unsubscribeAssignmentModified(this.assignmentsModified$);
    }
    if (this.groupFilterSub) {
      this.groupFilterSub.unsubscribe();
    }
    if (this.viewResizeObserver) {
      this.viewResizeObserver.disconnect();
    }
    this.trajectoryWarm.cancel();
  }

  loadGraph(startDate?: string, endDate?: string): void {
    this.loading = true;
    this.safeDetectChanges();
    this.loaderService.loadRepositories(startDate, endDate).subscribe(() => {
      this.loading = false;
      this.loadGraphDataAndRefresh();
    });
  }

  loadGraphDataAndRefresh(): void {
    if (!this.dataService.assignment) {
      this.safeDetectChanges();
      return;
    }

    const allSessions = this.dataService.sessions || [];
    const questions = this.dataService.questions || [];
    const repos = this.dataService.repositories || [];

    if (allSessions.length === 0) {
      this.sessionStatsList = [];
      this.macroStats = null;
      this.isCalculating = false;
      this.safeDetectChanges();
      return;
    }

    this.isCalculating = true;
    this.calcProgress = 30;
    this.safeDetectChanges();

    setTimeout(() => {
      // Compute stats for all sessions
      this.sessionStatsList = allSessions.map((session) => {
        const stats = this.sessionAnalyticsService.computeSessionStats(session, repos, questions);
        stats.displayName = this.getSessionDisplayName(session);
        return stats;
      });

      // Compute Macro overview stats
      this.computeMacroStats();

      // Ensure valid selected index
      const filtered = this.getFilteredSessions();
      this.applyDeepLink(filtered);
      const sessionToCenterIndex = this.sessionToCenter ? filtered.findIndex((stat) => stat.session === this.sessionToCenter) : -1;
      if (this.selectedSessionIndex >= filtered.length) {
        this.selectedSessionIndex = filtered.length > 0 ? 0 : -1;
      }
      if (sessionToCenterIndex >= 0) {
        this.sessionToCenter = undefined;
        setTimeout(() => this.scrollSelectedPillIntoView(sessionToCenterIndex), 50);
      }

      this.calcProgress = 100;
      this.isCalculating = false;
      this.safeDetectChanges();

      setTimeout(() => {
        this.renderCurrentCharts();
        this.updateRibbonNavButtons();
      }, 50);
    }, 10);
  }

  getFilteredSessions(): SessionDetailedStats[] {
    return filterSessionStats(this.sessionStatsList, this.dataService.groupFilter);
  }

  getCurrentSessionStats(): SessionDetailedStats | null {
    const filtered = this.getFilteredSessions();
    if (this.selectedSessionIndex >= 0 && this.selectedSessionIndex < filtered.length) {
      return filtered[this.selectedSessionIndex];
    }
    return null;
  }

  selectSession(index: number): void {
    this.selectedSessionIndex = index;
    this.safeDetectChanges();
    setTimeout(() => this.renderCurrentCharts(), 50);
    this.scrollSelectedPillIntoView(index);
  }

  onRibbonScroll(): void {
    this.updateRibbonNavButtons();
  }

  onRibbonWheel(event: WheelEvent): void {
    if (!this.ribbonBar?.nativeElement) return;
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      this.ribbonBar.nativeElement.scrollLeft += event.deltaY;
      this.updateRibbonNavButtons();
    }
  }

  scrollRibbon(direction: "left" | "right"): void {
    if (!this.ribbonBar?.nativeElement) return;
    const scrollAmount = direction === "left" ? -300 : 300;
    this.ribbonBar.nativeElement.scrollBy({ left: scrollAmount, behavior: "smooth" });
    setTimeout(() => this.updateRibbonNavButtons(), 250);
  }

  setActiveSubTab(tab: "timeline" | "matrix" | "students"): void {
    if (this.activeSubTab === tab) return;
    this.activeSubTab = tab;
    this.safeDetectChanges();
    if (tab === "timeline") {
      setTimeout(() => this.renderCurrentCharts(), 50);
    }
  }

  getCurrentSessionRepositories(): Repository[] {
    const stat = this.getCurrentSessionStats();
    if (!stat) return this.dataService.repositories || [];
    return (this.dataService.repositories || []).filter((r) => {
      if (!stat.session.tpGroup) return true;
      return r.tpGroup === stat.session.tpGroup;
    });
  }

  toggleDisplayMode(mode: "questions" | "commits"): void {
    this.displayMode = mode;
    this.safeDetectChanges();
    setTimeout(() => this.renderRibbonChart(), 30);
  }

  getFilteredStudents(): StudentSessionActivity[] {
    const stats = this.getCurrentSessionStats();
    if (!stats) return [];
    return filterStudentActivity(stats.studentsActivity, this.studentFilter);
  }

  // --- CHART RENDERING ---

  renderCurrentCharts(): void {
    if (this.selectedSessionIndex === -1) {
      this.renderComparisonChart();
    } else {
      this.renderRibbonChart();
      this.renderHistogramChart();
    }
  }

  // --- ACTIONS ---

  openAddSessionModal(): void {
    const modalRef = this.customModalService.open(EditSessionComponent, {});
    const now = this.clockService.now();
    const duration = this.dataService.assignment?.defaultSessionDuration || {
      hour: 2,
      minute: 0,
    };
    const endDate = new Date(now.getTime() + (duration.hour * 60 + duration.minute) * 60 * 1000);

    modalRef.componentInstance.session = new Session(now, endDate, this.dataService.groupFilter || undefined);
    modalRef.componentInstance.addMode = true;
    modalRef.componentInstance.defaultSessionDuration = duration;

    modalRef.result
      .then((newSession: Session) => {
        if (newSession) {
          this.dataService.sessions.push(newSession);
          this.saveAndRefreshAssignment();
          this.toastService.success(
            this.translateService.instant("SUCCESS") || "Succès",
            this.translateService.instant("SESSION-CREATED") || "Séance ajoutée",
          );
        }
      })
      .catch(() => {});
  }

  openEditSessionModal(session: Session): void {
    const modalRef = this.customModalService.open(EditSessionComponent, {});
    modalRef.componentInstance.session = session;
    modalRef.componentInstance.addMode = false;
    modalRef.componentInstance.defaultSessionDuration = this.dataService.assignment?.defaultSessionDuration;

    modalRef.result
      .then((result: Session | { deleted: true }) => {
        if (result && "deleted" in result) {
          this.deleteSession(session);
          return;
        }

        const updatedSession = result as Session;
        if (updatedSession) {
          const idx = this.dataService.sessions.indexOf(session);
          if (idx > -1) {
            this.dataService.sessions[idx] = updatedSession;
            this.sessionToCenter = updatedSession;
            this.saveAndRefreshAssignment();
            this.toastService.success(
              this.translateService.instant("SUCCESS") || "Succès",
              this.translateService.instant("SESSION-UPDATED") || "Séance mise à jour",
            );
          }
        }
      })
      .catch(() => {});
  }

  deleteSession(session: Session): void {
    const idx = this.dataService.sessions.indexOf(session);
    if (idx > -1) {
      this.dataService.sessions.splice(idx, 1);
      this.selectedSessionIndex = -1;
      this.sessionToCenter = undefined;
      this.saveAndRefreshAssignment();
      this.toastService.success(
        this.translateService.instant("SUCCESS") || "Succès",
        this.translateService.instant("SESSION-DELETED") || "Séance supprimée",
      );
    }
  }

  openSuggestSessionsModal(): void {
    const defaultDur = this.dataService.assignment?.defaultSessionDuration;
    const durMin = defaultDur ? defaultDur.hour * 60 + defaultDur.minute : 120;

    const suggestions = this.sessionAnalyticsService.detectSuggestedSessions(
      this.dataService.repositories || [],
      durMin,
      this.dataService.sessions || [],
    );

    const modalRef = this.customModalService.open(SuggestSessionsModalComponent, {});
    modalRef.componentInstance.suggestions = suggestions;

    modalRef.result
      .then((selectedSessions: Session[]) => {
        if (selectedSessions && selectedSessions.length > 0) {
          if (!this.dataService.sessions) {
            this.dataService.sessions = [];
          }
          this.dataService.sessions.push(...selectedSessions);
          this.saveAndRefreshAssignment();
          this.toastService.success(
            this.translateService.instant("SUCCESS") || "Succès",
            this.translateService.instant("SESSIONS-GRAPH.SUGGEST_MODAL.SUCCESS_TOAST", {
              count: selectedSessions.length,
            }) || `${selectedSessions.length} séances importées`,
          );
        }
      })
      .catch(() => {});
  }

  getSessionDisplayName(session: Session): string {
    return getSessionDisplayName(session, this.dataService?.sessions || [], this.translateService, {
      includeGroupSuffix: true,
      groupFilter: this.dataService.groupFilter,
    });
  }

  getResolvedQuestionsTooltip(questions: string[] | undefined): string {
    return buildResolvedQuestionsTooltip(questions, {
      empty: this.translateService.instant("SESSIONS-GRAPH.KPIS.NO_RESOLVED_QUESTIONS"),
      title: this.translateService.instant("SESSIONS-GRAPH.KPIS.RESOLVED_QUESTIONS_LIST"),
    });
  }

  getCurrentResolvedQuestions(): string[] {
    return (this.getCurrentSessionStats()?.questionsSummary || [])
      .filter((question) => question.closedByCount > 0)
      .map((question) => question.question);
  }

  // --- PRIVATE HELPERS & RENDERING ---

  /** Reads the "Voir tout" deep-link (session panel) so the target session and sub-tab are restored. */
  private readDeepLink(): void {
    const params = this.route.snapshot.queryParamMap;
    this.pendingDeepLink = parseSessionsDeepLink(params.get("session"), params.get("sub"));
  }

  /** Applies a pending deep-link once the stats (and thus the filtered list) are available. */
  private applyDeepLink(filtered: SessionDetailedStats[]): void {
    const deepLink = this.pendingDeepLink;
    if (!deepLink) {
      return;
    }
    const idx = findDeepLinkSessionIndex(filtered, deepLink.startMs);
    if (idx < 0) {
      return;
    }
    this.selectedSessionIndex = idx;
    if (deepLink.sub) {
      this.activeSubTab = deepLink.sub;
    }
    this.sessionToCenter = filtered[idx].session;
    this.pendingDeepLink = undefined;
  }

  private updateRibbonNavButtons(): void {
    if (!this.ribbonBar?.nativeElement) return;
    const el = this.ribbonBar.nativeElement;
    this.canScrollLeft = el.scrollLeft > 4;
    this.canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    this.safeDetectChanges();
  }

  private scrollSelectedPillIntoView(index: number): void {
    setTimeout(() => {
      if (!this.ribbonBar?.nativeElement) return;
      if (index === -1) {
        this.ribbonBar.nativeElement.scrollTo({ left: 0, behavior: "smooth" });
        setTimeout(() => this.updateRibbonNavButtons(), 250);
        return;
      }
      const pills = this.ribbonBar.nativeElement.querySelectorAll(".session-pill-btn");
      const targetPill = pills[index];
      if (targetPill) {
        targetPill.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        setTimeout(() => this.updateRibbonNavButtons(), 250);
      }
    }, 50);
  }

  private safeDetectChanges(): void {
    if (!(this.cdr as any).destroyed) {
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    }
  }

  private computeMacroStats(): void {
    const filtered = this.getFilteredSessions();
    if (filtered.length === 0) {
      this.macroStats = null;
      return;
    }

    this.macroStats = buildMacroStats(filtered, this.dataService.questions?.length || 0);
  }

  /**
   * Tracé D3.js de la courbe médiane de progression avec ruban de dispersion (votre image !)
   */
  private renderRibbonChart(): void {
    SessionRibbonChartRenderer.render(this);
  }

  private renderHistogramChart(): void {
    SessionMacroChartsRenderer.renderHistogram(this);
  }

  private renderComparisonChart(): void {
    SessionMacroChartsRenderer.renderComparison(this);
  }

  private saveAndRefreshAssignment(): void {
    if (this.dataService.assignment) {
      this.databaseService.saveAssignment(this.dataService.assignment);
      this.assignmentsService.assignmentModified.next();
    }
    this.loadGraphDataAndRefresh();
  }
}
