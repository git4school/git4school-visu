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
import { TranslateService } from "@ngx-translate/core";
import { AssignmentsService } from "@services/assignments.service";
import { DataService } from "@services/data.service";
import { LoaderService } from "@services/loader.service";
import { SessionAnalyticsService, SessionDetailedStats, StudentSessionActivity } from "@services/session-analytics.service";
import { ThemeService } from "@services/theme.service";
import { ToastService } from "@services/toast.service";
import { TooltipService } from "@services/tooltip.service";
import { DatabaseService } from "@services/database.service";
import { Utils } from "@services/utils";
import { CustomModalService } from "@shared/ui/custom-modal/custom-modal.service";
import { EditSessionComponent } from "@components/edit-session/edit-session.component";
import { SuggestSessionsModalComponent } from "./suggest-sessions-modal/suggest-sessions-modal.component";
import { BaseGraphComponent } from "../base-graph.component";
import * as d3 from "d3";
import * as moment from "moment";
import { Subscription } from "rxjs";

export interface MacroSessionOverview {
  totalSessionsCount: number;
  averageParticipationRate: number;
  totalInSessionCommits: number;
  totalOutOfSessionCommits: number;
  inSessionRatio: number;
  outOfSessionRatio: number;
  totalHoursSupervised: string;
  questionsAddressedCount: number;
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
  @ViewChild("ribbonBar") ribbonBar?: ElementRef<HTMLDivElement>;
  @ViewChild("d3TooltipTemplate") d3TooltipTemplate!: TemplateRef<any>;

  selectedSessionIndex = -1; // -1 for Macro "Toutes les séances"
  displayMode: "questions" | "commits" = "questions";
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
  private resizeObserver?: any;

  constructor(
    public dataService: DataService,
    public translateService: TranslateService,
    public themeService: ThemeService,
    protected loaderService: LoaderService,
    protected assignmentsService: AssignmentsService,
    private sessionAnalyticsService: SessionAnalyticsService,
    private tooltipService: TooltipService,
    private toastService: ToastService,
    private customModalService: CustomModalService,
    private databaseService: DatabaseService,
    private cdr: ChangeDetectorRef,
  ) {
    super(loaderService, assignmentsService, dataService);
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

  ngOnInit(): void {
    this.assignmentsModified$ = this.subscribeAssignmentModified();
    this.translateService.onLangChange.subscribe(() => {
      this.loadGraphDataAndRefresh();
    });

    if (this.dataService.repoToLoad) {
      this.loadGraph(this.dataService.startDate, this.dataService.endDate);
    } else {
      this.loadGraphDataAndRefresh();
    }
  }

  ngAfterViewInit(): void {
    this.resizeObserver = new (window as any).ResizeObserver(() => {
      this.renderCurrentCharts();
      this.updateRibbonNavButtons();
    });

    const checkAndObserve = () => {
      const el = this.ribbonChartContainer?.nativeElement || this.comparisonChartContainer?.nativeElement;
      if (el) {
        this.resizeObserver.observe(el);
      }
      if (this.ribbonBar?.nativeElement) {
        this.resizeObserver.observe(this.ribbonBar.nativeElement);
        this.updateRibbonNavButtons();
      }
    };

    setTimeout(checkAndObserve, 100);
  }

  ngOnDestroy(): void {
    if (this.assignmentsModified$) {
      this.unsubscribeAssignmentModified(this.assignmentsModified$);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
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
      if (this.selectedSessionIndex >= filtered.length) {
        this.selectedSessionIndex = filtered.length > 0 ? 0 : -1;
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
    const groupFilter = this.dataService.groupFilter;
    if (!groupFilter) {
      return this.sessionStatsList;
    }
    return this.sessionStatsList.filter((stat) => !stat.session.tpGroup || stat.session.tpGroup === groupFilter);
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

    let list = stats.studentsActivity;
    if (this.studentFilter === "active") {
      list = list.filter((s) => s.status === "active");
    } else if (this.studentFilter === "inactive") {
      list = list.filter((s) => s.status === "inactive" || s.status === "low");
    }
    return list;
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
    const now = new Date();
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
      .then((updatedSession: Session) => {
        if (updatedSession) {
          const idx = this.dataService.sessions.indexOf(session);
          if (idx > -1) {
            this.dataService.sessions[idx] = updatedSession;
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
    if (!session) return "";
    if (session.label && session.label.trim().length > 0) {
      const baseLabel = session.label.trim();
      return session.tpGroup && !this.dataService.groupFilter ? `${baseLabel} (${session.tpGroup})` : baseLabel;
    }
    const allSessions = this.dataService?.sessions || [];
    const sameGroup = allSessions
      .filter((s) => (s.tpGroup || "") === (session.tpGroup || ""))
      .slice()
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    let idx = sameGroup.indexOf(session);
    if (idx === -1) {
      idx = sameGroup.findIndex(
        (s) =>
          new Date(s.startDate).getTime() === new Date(session.startDate).getTime() &&
          new Date(s.endDate).getTime() === new Date(session.endDate).getTime() &&
          (s.tpGroup || "") === (session.tpGroup || ""),
      );
    }
    const num = idx >= 0 ? idx + 1 : 1;
    const defaultName = this.translateService.instant("DEFAULT-SESSION-NAME", {
      number: num,
    });
    const baseName = defaultName && defaultName !== "DEFAULT-SESSION-NAME" ? defaultName : `Séance ${num}`;
    return session.tpGroup && !this.dataService.groupFilter ? `${baseName} (${session.tpGroup})` : baseName;
  }

  // --- PRIVATE HELPERS & RENDERING ---

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

  private getSmartTooltipPlacement(
    cx: number,
    cy: number,
    innerWidth: number,
    innerHeight: number,
    clientX: number,
    clientY: number,
  ): { x: number; y: number; placement: "top" | "bottom" | "left" | "right"; customOffset: { x: number; y: number } } {
    // Cumulative curves are monotonic non-decreasing:
    // - Top-Left quadrant (x' < x, y' < y in SVG) is mathematically guaranteed to be free of curve points.
    // - Bottom-Right quadrant (x' > x, y' > y in SVG) is mathematically guaranteed to be free of curve points.
    const canUseTopLeft = cy > 50 && clientY > 190 && cx > 60 && clientX > 160;

    if (canUseTopLeft) {
      return {
        x: clientX,
        y: clientY,
        placement: "top",
        customOffset: { x: -65, y: -6 },
      };
    } else {
      return {
        x: clientX,
        y: clientY,
        placement: "bottom",
        customOffset: { x: 65, y: 6 },
      };
    }
  }

  private computeMacroStats(): void {
    const filtered = this.getFilteredSessions();
    if (filtered.length === 0) {
      this.macroStats = null;
      return;
    }

    const totalSessions = filtered.length;
    let sumPartRate = 0;
    let totalInSessionCommits = 0;
    let totalAllCommits = 0;
    let totalDurationMinutes = 0;
    const questionsSet = new Set<string>();

    filtered.forEach((stat) => {
      sumPartRate += stat.participationRate;
      totalInSessionCommits += stat.inSessionCommitsCount;
      totalAllCommits += stat.totalPeriodCommitsCount;

      const start = new Date(stat.session.startDate).getTime();
      const end = new Date(stat.gracePeriod?.effectiveEndDate || stat.session.endDate).getTime();
      totalDurationMinutes += Math.max(0, (end - start) / 60000);

      stat.questionsSummary?.forEach((qs) => {
        if (qs.closedByCount > 0) {
          questionsSet.add(qs.question);
        }
      });
      stat.ribbonData?.studentCommitsPoints?.forEach((p) => {
        if (p.questionName) questionsSet.add(p.questionName);
      });
    });

    const averageParticipationRate = totalSessions > 0 ? sumPartRate / totalSessions : 0;
    const totalOutOfSessionCommits = Math.max(0, totalAllCommits - totalInSessionCommits);
    const inSessionRatio = totalAllCommits > 0 ? (totalInSessionCommits / totalAllCommits) * 100 : 100;
    const outOfSessionRatio = Math.max(0, 100 - inSessionRatio);

    const hours = Math.floor(totalDurationMinutes / 60);
    const minutes = Math.round(totalDurationMinutes % 60);
    const totalHoursSupervised = minutes > 0 ? `${hours}h${minutes.toString().padStart(2, "0")}` : `${hours}h`;

    this.macroStats = {
      totalSessionsCount: totalSessions,
      averageParticipationRate,
      totalInSessionCommits,
      totalOutOfSessionCommits,
      inSessionRatio,
      outOfSessionRatio,
      totalHoursSupervised,
      questionsAddressedCount: questionsSet.size,
      totalQuestionsCount: this.dataService.questions?.length || 0,
      sessionsStats: filtered,
    };
  }

  /**
   * Tracé D3.js de la courbe médiane de progression avec ruban de dispersion (votre image !)
   */
  private renderRibbonChart(): void {
    if (!this.ribbonChartContainer?.nativeElement) return;
    const container = this.ribbonChartContainer.nativeElement;
    d3.select(container).selectAll("*").remove();

    const stats = this.getCurrentSessionStats();
    if (!stats || !stats.ribbonData) return;

    const bounds = container.getBoundingClientRect();
    const width = Math.max(300, bounds.width);
    const height = 340;
    const margin = { top: 30, right: 35, bottom: 45, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    const svg = d3.select(container).append("svg").attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const startDate = new Date(stats.session.startDate);
    const endDate = stats.gracePeriod.effectiveEndDate;

    // X Scale: Time
    const xScale = d3.scaleTime().domain([startDate, endDate]).range([0, innerWidth]);

    // Y Scale
    const isQuestions = this.displayMode === "questions";
    const questions = this.dataService.questions || [];
    const maxCommits = d3.max(stats.ribbonData.studentCommitsPoints, (p) => p.cumulativeCommits) || 5;

    const yScale = d3
      .scaleLinear()
      .domain([0, isQuestions ? Math.max(1, questions.length) : maxCommits])
      .nice()
      .range([innerHeight, 0]);

    // Grid lines
    const yGrid = d3
      .axisLeft(yScale)
      .ticks(isQuestions ? Math.min(questions.length, 6) : 5)
      .tickSize(-innerWidth)
      .tickFormat(() => "");

    g.append("g").attr("class", "grid-lines").style("stroke-opacity", "0.08").call(yGrid);

    // Axes
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(Math.max(3, Math.floor(innerWidth / 90)))
      .tickFormat((d: any) => moment(d).format("HH:mm"));

    const yAxis = d3
      .axisLeft(yScale)
      .ticks(isQuestions ? questions.length : 5)
      .tickFormat((d: any) => {
        const val = Math.round(Number(d));
        if (isQuestions) {
          if (val === 0) return "0";
          return questions[val - 1] || `Q${val}`;
        }
        return `${val}`;
      });

    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll("text")
      .style("fill", "var(--color-text-secondary)")
      .style("font-size", "11px");

    g.append("g")
      .attr("class", "y-axis")
      .call(yAxis)
      .selectAll("text")
      .style("fill", "var(--color-text-secondary)")
      .style("font-size", "11px");

    // Axis titles
    svg
      .append("text")
      .attr("x", margin.left)
      .attr("y", 18)
      .attr("fill", "var(--color-text-secondary)")
      .style("font-size", "11px")
      .style("font-weight", "500")
      .text(
        isQuestions
          ? this.translateService.instant("SESSIONS-GRAPH.RIBBON.Y_AXIS_QUESTIONS") || "Questions complétées"
          : this.translateService.instant("SESSIONS-GRAPH.RIBBON.Y_AXIS_COMMITS") || "Commits cumulés",
      );

    const ribbonPoints = isQuestions ? stats.ribbonData.questionsRibbon : stats.ribbonData.commitsRibbon;

    // 1. Dispersion Ribbon (Area between Q1 and Q3)
    const area = d3
      .area<any>()
      .x((d) => xScale(d.time))
      .y0((d) => yScale(d.q1))
      .y1((d) => yScale(d.q3))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(ribbonPoints)
      .attr("class", "dispersion-ribbon")
      .attr("d", area)
      .style("fill", "var(--color-primary)")
      .style("fill-opacity", "0.14");

    // 2. Median Trend Line
    const line = d3
      .line<any>()
      .x((d) => xScale(d.time))
      .y((d) => yScale(d.median))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(ribbonPoints)
      .attr("class", "trend-line")
      .attr("d", line)
      .style("fill", "none")
      .style("stroke", "var(--color-primary)")
      .style("stroke-width", "2.5px")
      .style("stroke-linecap", "round");

    // 3. Dedicated layer for student hover trajectory curve
    const hoverTrajectoryGroup = g.append("g").attr("class", "student-hover-trajectory").style("pointer-events", "none");

    // 4. Scatter Points (Student Commits)
    const pointsGroup = g.append("g").attr("class", "scatter-points");

    const validPoints = stats.ribbonData.studentCommitsPoints.filter((p) => {
      const yVal = isQuestions ? p.questionIndex : p.cumulativeCommits;
      return !(yVal === 0 && isQuestions);
    });

    validPoints.forEach((p) => {
      const yVal = isQuestions ? p.questionIndex : p.cumulativeCommits;
      const cx = xScale(p.time);
      const cy = yScale(yVal);
      const dotColor = p.commit.color?.color || "var(--color-commit-intermediate)";

      const circle = pointsGroup
        .append("circle")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", p.isCloture ? 5.5 : 4)
        .attr("data-student", p.student)
        .attr("data-repo-id", p.repoId)
        .attr("data-cloture", p.isCloture ? "true" : "false")
        .style("fill", dotColor)
        .style("stroke", "var(--color-surface)")
        .style("stroke-width", p.isCloture ? "2px" : "1.5px")
        .style("cursor", "pointer")
        .style("transition", "transform 0.15s ease, r 0.15s ease, opacity 0.15s ease");

      circle
        .on("mouseenter", (event: MouseEvent) => {
          // Tooltip
          const tooltipData = {
            student: Utils.truncateMiddle(p.student, Utils.OVERVIEW_NAME_LENGTH_LIMIT),
            commitDate: p.time,
            questionName: p.questionName,
            message: p.commit.message,
            cumulative: p.cumulativeCommits,
            isCloture: p.isCloture,
            url: p.commit.url,
          };
          const {
            x: tX,
            y: tY,
            placement,
            customOffset,
          } = this.getSmartTooltipPlacement(cx, cy, innerWidth, innerHeight, event.clientX, event.clientY);
          this.tooltipService.showAtPosition(
            this.d3TooltipTemplate,
            tX,
            tY,
            placement,
            undefined,
            true,
            { tooltipData },
            undefined,
            customOffset,
          );

          // Dim dots of other students and enlarge dots of this student repository
          pointsGroup
            .selectAll<SVGCircleElement, any>("circle")
            .style("opacity", function () {
              const rId = d3.select(this).attr("data-repo-id");
              const st = d3.select(this).attr("data-student");
              const isMatch = p.repoId && rId ? rId === p.repoId : st === p.student;
              return isMatch ? "1" : "0.15";
            })
            .attr("r", function () {
              const rId = d3.select(this).attr("data-repo-id");
              const st = d3.select(this).attr("data-student");
              const isMatch = p.repoId && rId ? rId === p.repoId : st === p.student;
              const isCloture = d3.select(this).attr("data-cloture") === "true";
              const isCurrent = this === event.currentTarget;
              if (isMatch) {
                return isCurrent ? (isCloture ? 8.5 : 7) : isCloture ? 6.5 : 5;
              }
              return isCloture ? 4 : 3;
            });

          // Draw the student's individual trajectory curve
          hoverTrajectoryGroup.selectAll("*").remove();

          const studentPoints = validPoints
            .filter((pt) => (p.repoId && pt.repoId ? pt.repoId === p.repoId : pt.student === p.student))
            .slice()
            .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

          if (studentPoints.length > 0) {
            // Anchor curve at start of session (time: startDate, val: 0)
            const curvePoints: Array<{ time: Date; val: number }> = [{ time: startDate, val: 0 }];

            studentPoints.forEach((pt) => {
              curvePoints.push({
                time: new Date(pt.time),
                val: isQuestions ? pt.questionIndex : pt.cumulativeCommits,
              });
            });

            const studentLine = d3
              .line<{ time: Date; val: number }>()
              .x((d) => xScale(d.time))
              .y((d) => yScale(d.val))
              .curve(d3.curveMonotoneX);

            hoverTrajectoryGroup
              .append("path")
              .datum(curvePoints)
              .attr("class", "student-trajectory-line")
              .attr("d", studentLine)
              .style("fill", "none")
              .style("stroke", "var(--color-primary)")
              .style("stroke-width", "2px")
              .style("stroke-linecap", "round")
              .style("stroke-linejoin", "round")
              .style("stroke-dasharray", "4,3")
              .style("opacity", "0")
              .transition()
              .duration(150)
              .style("opacity", "0.85");
          }
        })
        .on("mouseleave", () => {
          this.tooltipService.hide();

          // Clear trajectory line
          hoverTrajectoryGroup.selectAll("*").remove();

          // Restore all circles
          pointsGroup
            .selectAll<SVGCircleElement, any>("circle")
            .style("opacity", "1")
            .attr("r", function () {
              const isCloture = d3.select(this).attr("data-cloture") === "true";
              return isCloture ? 5.5 : 4;
            });
        })
        .on("click", () => {
          if (p.commit.url) {
            window.open(p.commit.url, "_blank");
          }
        });
    });

    // 4. End of official session line (if grace extended)
    if (stats.gracePeriod.isExtended) {
      const officialEndX = xScale(new Date(stats.session.endDate));
      if (officialEndX > 0 && officialEndX < innerWidth) {
        g.append("line")
          .attr("x1", officialEndX)
          .attr("x2", officialEndX)
          .attr("y1", 0)
          .attr("y2", innerHeight)
          .style("stroke", "var(--color-warning)")
          .style("stroke-width", "1.5px")
          .style("stroke-dasharray", "4,4");

        g.append("text")
          .attr("x", officialEndX - 6)
          .attr("y", 12)
          .attr("text-anchor", "end")
          .style("fill", "var(--color-warning)")
          .style("font-size", "10px")
          .style("font-weight", "600")
          .text(this.translateService.instant("SESSIONS-GRAPH.OFFICIAL_END") || "Fin officielle");
      }
    }
  }

  /**
   * Tracé D3.js de l'histogramme de rythme par tranches de 15 minutes
   */
  private renderHistogramChart(): void {
    if (!this.histogramChartContainer?.nativeElement) return;
    const container = this.histogramChartContainer.nativeElement;
    d3.select(container).selectAll("*").remove();

    const stats = this.getCurrentSessionStats();
    if (!stats || !stats.histogramBuckets || stats.histogramBuckets.length === 0) return;

    const bounds = container.getBoundingClientRect();
    const width = Math.max(300, bounds.width);
    const height = 210;
    const margin = { top: 20, right: 35, bottom: 40, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    const svg = d3.select(container).append("svg").attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const buckets = stats.histogramBuckets;
    const maxTotal = d3.max(buckets, (b) => b.total) || 1;

    const xScale = d3
      .scaleBand()
      .domain(buckets.map((b) => b.label))
      .range([0, innerWidth])
      .padding(0.25);

    const yScale = d3.scaleLinear().domain([0, maxTotal]).nice().range([innerHeight, 0]);

    // Grid lines
    g.append("g")
      .attr("class", "grid-lines")
      .style("stroke-opacity", "0.08")
      .call(
        d3
          .axisLeft(yScale)
          .ticks(4)
          .tickSize(-innerWidth)
          .tickFormat(() => ""),
      );

    // X Axis
    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll("text")
      .style("fill", "var(--color-text-secondary)")
      .style("font-size", "11px");

    // Y Axis
    g.append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(yScale).ticks(4))
      .selectAll("text")
      .style("fill", "var(--color-text-secondary)")
      .style("font-size", "11px");

    // Bars
    buckets.forEach((bucket) => {
      const bx = xScale(bucket.label);
      if (bx === undefined) return;
      const bWidth = xScale.bandwidth();

      // Stack colored segments
      let currentY = innerHeight;
      const colorKeys = ["intermediate", "green", "orange", "red"];

      colorKeys.forEach((colorKey) => {
        const count = bucket.countsByColor[colorKey] || 0;
        if (count <= 0) return;

        const segHeight = innerHeight - yScale(count);
        currentY -= segHeight;

        let col = "var(--color-commit-intermediate)";
        if (colorKey === "green") col = "var(--color-success)";
        else if (colorKey === "orange") col = "var(--color-warning)";
        else if (colorKey === "red") col = "var(--color-danger)";

        g.append("rect")
          .attr("x", bx)
          .attr("y", currentY)
          .attr("width", bWidth)
          .attr("height", segHeight)
          .attr("rx", 3)
          .style("fill", col)
          .style("cursor", "pointer")
          .on("mouseenter", (event: MouseEvent) => {
            const tooltipData = {
              isHistogram: true,
              slot: `${bucket.label} - ${moment(bucket.endDate).format("HH:mm")}`,
              totalCommits: bucket.total,
              closingCommits: bucket.closingCommitsCount,
            };
            this.tooltipService.showAtPosition(this.d3TooltipTemplate, event.clientX, event.clientY, "top", undefined, true, {
              tooltipData,
            });
          })
          .on("mouseleave", () => this.tooltipService.hide());
      });
    });
  }

  /**
   * Tracé D3.js de la vue Macro : Comparatif des séances
   */
  private renderComparisonChart(): void {
    if (!this.comparisonChartContainer?.nativeElement) return;
    const container = this.comparisonChartContainer.nativeElement;
    d3.select(container).selectAll("*").remove();

    const filtered = this.getFilteredSessions();
    if (filtered.length === 0) return;

    const bounds = container.getBoundingClientRect();
    const width = Math.max(300, bounds.width);
    const height = 260;
    const margin = { top: 30, right: 35, bottom: 45, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    const svg = d3.select(container).append("svg").attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const labels = filtered.map((s) => s.displayName);

    const xScale = d3.scaleBand().domain(labels).range([0, innerWidth]).padding(0.3);

    const yScale = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);

    // Grid lines
    g.append("g")
      .attr("class", "grid-lines")
      .style("stroke-opacity", "0.08")
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickSize(-innerWidth)
          .tickFormat(() => ""),
      );

    // Axes
    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll("text")
      .style("fill", "var(--color-text-secondary)")
      .style("font-size", "11px");

    g.append("g")
      .attr("class", "y-axis")
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickFormat((d) => `${d}%`),
      )
      .selectAll("text")
      .style("fill", "var(--color-text-secondary)")
      .style("font-size", "11px");

    // Title
    svg
      .append("text")
      .attr("x", margin.left)
      .attr("y", 16)
      .attr("fill", "var(--color-text-secondary)")
      .style("font-size", "11px")
      .style("font-weight", "500")
      .text(this.translateService.instant("SESSIONS-GRAPH.MACRO.CHART_TITLE") || "Taux de présence active par séance (%)");

    // Bars
    filtered.forEach((stat, i) => {
      const bx = xScale(stat.displayName);
      if (bx === undefined) return;
      const bWidth = xScale.bandwidth();
      const bHeight = innerHeight - yScale(stat.participationRate);

      g.append("rect")
        .attr("x", bx)
        .attr("y", yScale(stat.participationRate))
        .attr("width", bWidth)
        .attr("height", bHeight)
        .attr("rx", 4)
        .style("fill", "var(--color-primary)")
        .style("opacity", "0.85")
        .style("cursor", "pointer")
        .on("mouseenter", function () {
          d3.select(this).style("opacity", "1");
        })
        .on("mouseleave", function () {
          d3.select(this).style("opacity", "0.85");
        })
        .on("click", () => {
          this.selectSession(i);
        });

      // Percentage label on top of bar
      g.append("text")
        .attr("x", bx + bWidth / 2)
        .attr("y", yScale(stat.participationRate) - 6)
        .attr("text-anchor", "middle")
        .style("fill", "var(--color-text-primary)")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .text(`${Math.round(stat.participationRate)}%`);
    });
  }

  private saveAndRefreshAssignment(): void {
    if (this.dataService.assignment) {
      this.databaseService.saveAssignment(this.dataService.assignment);
      this.assignmentsService.assignmentModified.next();
    }
    this.loadGraphDataAndRefresh();
  }
}
