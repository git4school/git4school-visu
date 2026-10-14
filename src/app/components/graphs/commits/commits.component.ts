import {
  AfterViewInit,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
  ViewEncapsulation,
  NgZone,
} from "@angular/core";
import { FileChooserComponent } from "@components/file-chooser/file-chooser.component";
import { OverviewGraphContextualMenuComponent } from "@components/overview-graph-contextual-menu/overview-graph-contextual-menu.component";
import { Commit, CommitColor } from "@models/Commit.model";
import { Milestone } from "@models/Milestone.model";
import { Session } from "@models/Session.model";
import { NgbDropdown, NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { TranslateService, TranslationChangeEvent } from "@ngx-translate/core";
import { AssignmentsService } from "@services/assignments.service";
import { DataService } from "@services/data.service";
import { JsonManagerService } from "@services/json-manager.service";
import { LoaderService } from "@services/loader.service";
import { ToastService } from "@services/toast.service";
import { ThemeService } from "@services/theme.service";
import { TooltipService } from "@services/tooltip.service";
import { OverlayManagerService, OverlayType } from "@services/overlay-manager.service";
import { AnonymizationService } from "@services/anonymization.service";
import { ClockService } from "@services/clock.service";
import { getSessionDisplayName } from "@services/session-label.util";
import {
  compareSessions,
  computeOverlapGroups,
  findOverlapGroup,
  formatSelectionDuration,
  getGroupId,
  getSessionKeyNum,
  isSameSession,
  resolveActiveSession,
  resolveSessionAtDate,
  SessionResolutionContext,
  sessionCoversTime,
  SessionUidFactory,
  sessionsOverlap,
} from "@services/session-graph.util";
import { Subject, Subscription } from "rxjs";
import { skip, takeUntil } from "rxjs/operators";
import { BaseGraphComponent } from "../base-graph.component";
import { OsUtils } from "@utils/os.utils";

import * as d3 from "d3";
import * as moment from "moment";
import { Repository } from "../../../models/Repository.model";
import { Utils } from "@services/utils";
import { FilterGroup } from "@components/questions-chooser/questions-chooser.component";
import { SessionHeaderRenderer } from "./session-header-renderer";
import { SessionTransformsRenderer } from "./session-transforms.renderer";
import { MilestoneMaskRenderer } from "./milestone-mask.renderer";
import { MilestoneDragRenderer } from "./milestone-drag.renderer";
import { formatCommitHour } from "./commits-format.util";
import { COMMIT_GROUP_HEIGHT, CommitGroupsRenderer } from "./commit-groups.renderer";
import { ViewportRenderer } from "./viewport.renderer";
import { GraphPointsRenderer } from "./graph-points.renderer";

@Component({
  selector: "commits",
  templateUrl: "./commits.component.html",
  styleUrls: ["./commits.component.scss", "./chart.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class CommitsComponent extends BaseGraphComponent implements OnInit, AfterViewInit, OnDestroy {
  static CIRCLE_RADIUS = 12;

  @ViewChild(OverviewGraphContextualMenuComponent) contextualMenu;
  @ViewChild("questionsChooser") questionsChooser;
  @ViewChild("legendDropdown") legendDropdown?: NgbDropdown;
  @ViewChild("d3TooltipTemplate") d3TooltipTemplate!: TemplateRef<any>;

  private destroy$ = new Subject<void>();

  minZoom: number;

  contextualMenuShown: boolean;

  assignmentsModified$: Subscription;
  groupFilterSub: Subscription;

  displayModes = {
    opacity: false,
    height: false,
    text: false,
  };

  typeaheadSettings;
  searchFilter: string[] = [];

  commitMessagesFilter: string[] = [];
  filterGroups: FilterGroup[] = [];
  filteredCommitsCount = 0;
  filteredStudentsCount = 0;
  hiddenCategories = new Set<string>();
  commitColors = [CommitColor.INTERMEDIATE, CommitColor.BEFORE, CommitColor.BETWEEN, CommitColor.AFTER];
  unit = "day";
  drag = false;
  chartData = [{ data: [] }];
  showSessions = true;
  showCorrections = true;
  showReviews = true;
  showOthers = true;
  // Modal variables
  dateModal;
  labelModal: string;
  tpGroupModal: string;
  questionsModal: string[];
  typeModal: string;
  addModal: boolean;
  savedMilestoneModal: Milestone;

  // params
  inner_margin;
  margin_abs;
  width;
  height;
  maxZoom: number;

  // svg components
  svg: d3.Selection<any, any, any, any>;
  scrollable: d3.Selection<any, any, any, any>;
  chart_svg: d3.Selection<any, any, any, any>;
  x_g: d3.Selection<SVGGElement, any, any, any>;
  y_g: d3.Selection<SVGGElement, any, any, any>;
  repository_g: d3.Selection<any, any, any, any>;
  repositories_g: d3.Selection<any, Repository, any, any>[];
  axis_g: d3.Selection<SVGGElement, any, any, any>;
  axis_abs_g: d3.Selection<SVGGElement, any, any, any>;
  other_g: d3.Selection<any, any, any, any>;
  session_g: d3.Selection<any, any, any, any>;
  session_header_g: d3.Selection<any, any, any, any>;
  overlapGroups: Session[][] = [];
  activeSessionIndices: Map<string, number> = new Map();
  lastFocusedSession: Session = null;
  review_g: d3.Selection<any, any, any, any>;
  correction_g: d3.Selection<any, any, any, any>;
  milestones_g: d3.Selection<any, any, any, any>;
  commits_line_g: d3.Selection<any, any, any, any>;
  data_g: d3.Selection<any, any, any, any>;
  commits_g: d3.Selection<any, any, any, any>;
  now_g: d3.Selection<any, any, any, any>;

  x_scale: d3.ScaleTime<any, any, any>;
  x_scale_copy: d3.ScaleTime<any, any, any>; // Used by zooming
  x_axis: d3.Axis<Date | d3.NumberValue>;
  y_scale: d3.ScaleLinear<any, any, any>;
  y_axis: d3.Axis<d3.NumberValue>;

  clip: d3.Selection<any, any, any, any>;
  zoom: d3.ZoomBehavior<any, any>;

  hovered_commit: Commit;
  hovered_session: Session;
  hovered_group_commit: Commit[];
  hovered_milestone: Milestone;
  hovered_repository: Repository;
  private milestoneHoverTimer: any = null;
  private readonly MILESTONE_HOVER_DELAY = 600; // ms
  hovered_g: d3.Selection<any, any, any, any>;

  brush: d3.BrushBehavior<any>;
  current_zoom: any;
  chart_abs_g: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  svg_abs: d3.Selection<any, unknown, HTMLElement, any>;
  chart_selection_g: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  svg_selection: d3.Selection<any, unknown, HTMLElement, any>;
  real_height: number;
  chart_width: number;
  repo_spacing: number;
  inner_width: number;
  inner_height: number;
  scrollable_height: number;
  private viewResizeObserver: any;
  private resizeTimeout: any;
  public last_zoom_k = 0;
  private zoomTimeoutId: any = null;
  public zoomRafId: number | null = null;
  private nowTicker: any = null;
  private nowLabelWidth = 64;
  isRefreshing = false;
  private isThrottledGroupUpdate = false;
  private needsGroupUpdate = false;

  isDraggingMilestone = false;
  hasMovedDuringDrag = false;
  dragScrollTimer: d3.Timer;
  dragTimeIndicator: d3.Selection<any, any, any, any>;
  milestoneLongPressTimer: any = null;
  activeMilestoneBadge: d3.Selection<any, any, any, any> = null;
  activeMilestoneCleanupFn: (() => void) | null = null;
  ignoreNextMilestoneClick = false;
  readonly MILESTONE_HOLD_DURATION = 700;
  readonly MILESTONE_DRAG_JITTER_TOLERANCE = 5;
  readonly MILESTONE_CLICK_SUPPRESSION_DELAY = 300;
  isSessionTooltipPinned = false;
  isShiftDragging = false;
  private sessionClickTimer: any = null;
  private lastClickedSession: Session | null = null;
  private sessionUids = new SessionUidFactory();
  ////////////////////////

  public modeHoverState: any = {
    opacity: { isHovered: false, wasClicked: false },
    height: { isHovered: false, wasClicked: false },
    text: { isHovered: false, wasClicked: false },
  };

  onModeMouseEnter(mode: string) {
    this.modeHoverState[mode].isHovered = true;
    this.modeHoverState[mode].wasClicked = false;
  }

  onModeMouseLeave(mode: string) {
    this.modeHoverState[mode].isHovered = false;
    this.modeHoverState[mode].wasClicked = false;
  }

  public markerHoverState: any = {
    sessions: { isHovered: false, wasClicked: false },
    corrections: { isHovered: false, wasClicked: false },
    reviews: { isHovered: false, wasClicked: false },
    others: { isHovered: false, wasClicked: false },
  };

  onMarkerMouseEnter(marker: string) {
    this.markerHoverState[marker].isHovered = true;
    this.markerHoverState[marker].wasClicked = false;
  }

  onMarkerMouseLeave(marker: string) {
    this.markerHoverState[marker].isHovered = false;
    this.markerHoverState[marker].wasClicked = false;
  }

  onMarkerChange(marker: string) {
    this.markerHoverState[marker].wasClicked = true;
    const currentInnerTop = this.inner_margin?.top ?? 0;
    const nextStripHeight = this.loading ? 0 : this.getTopStripHeight();

    if (currentInnerTop !== nextStripHeight) {
      this.loadGraphDataAndRefresh(true);
    } else {
      if (marker === "sessions") {
        this.loadSessionAnnotations();
      } else {
        this.loadMilestoneAnnotations();
      }
    }
  }

  saveMarkerPreferences() {
    const preferences = {
      showSessions: this.showSessions,
      showCorrections: this.showCorrections,
      showReviews: this.showReviews,
      showOthers: this.showOthers,
    };
    localStorage.setItem("markerPreferences", JSON.stringify(preferences));
  }

  constructor(
    public translateService: TranslateService,
    private toastService: ToastService,
    public jsonManager: JsonManagerService,
    public dataService: DataService,
    protected loaderService: LoaderService,
    private modalService: NgbModal,
    protected assignmentsService: AssignmentsService,
    public themeService: ThemeService,
    public tooltipService: TooltipService,
    public anonymizationService: AnonymizationService,
    public ngZone: NgZone,
    public overlayManagerService: OverlayManagerService,
    public clockService: ClockService,
  ) {
    super(loaderService, assignmentsService, dataService, translateService, anonymizationService);
  }

  ngOnInit(): void {
    const savedModes = localStorage.getItem("commitDisplayModes");
    if (savedModes) {
      try {
        this.displayModes = JSON.parse(savedModes);
      } catch (e) {}
    }

    const savedMarkers = localStorage.getItem("markerPreferences");
    if (savedMarkers) {
      try {
        const parsed = JSON.parse(savedMarkers);
        this.showSessions = parsed.showSessions ?? true;
        this.showCorrections = parsed.showCorrections ?? true;
        this.showReviews = parsed.showReviews ?? true;
        this.showOthers = parsed.showOthers ?? true;
      } catch (e) {}
    }

    this.contextualMenuShown = false;
    this.assignmentsModified$ = this.subscribeAssignmentModified();
    /* Le filtre de groupe est global (navbar) : rafraîchir la vue à chaque changement. */
    this.groupFilterSub = this.dataService.groupFilter$.subscribe(() => this.loadGraphDataAndRefresh(false));
    this.updateLang();
    this.translateService.onLangChange.subscribe((_event: TranslationChangeEvent) => {
      this.updateLang();
    });

    this.anonymizationService.isAnonymous$.pipe(skip(1), takeUntil(this.destroy$)).subscribe(() => {
      this.loadGraphDataAndRefresh(true);
    });

    this.overlayManagerService.dismiss$.pipe(takeUntil(this.destroy$)).subscribe((event) => {
      if (OverlayManagerService.shouldDismiss(OverlayType.DROPDOWN, event)) {
        if (this.legendDropdown && this.legendDropdown.isOpen()) {
          this.legendDropdown.close();
        }
      }
      if (OverlayManagerService.shouldDismiss(OverlayType.TOOLTIP, event)) {
        if (this.sessionClickTimer) {
          clearTimeout(this.sessionClickTimer);
          this.sessionClickTimer = null;
          this.lastClickedSession = null;
        }
        this.isSessionTooltipPinned = false;
        this.hovered_session = undefined;
      }
    });

    /* Follow the simulated clock (dev bar) and keep the "now" marker in sync with wall time. */
    this.clockService.offsetMs$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.tickNowIndicator();
    });
    this.nowTicker = setInterval(() => this.tickNowIndicator(), 60000);
  }

  pressedShortcut: string = null;

  @HostListener("document:keydown", ["$event"])
  handleGlobalShortcuts(event: KeyboardEvent) {
    if (document.body.classList.contains("modal-open") || document.querySelector(".modal.show, .custom-modal-backdrop") !== null) {
      return;
    }

    if (OsUtils.isTypingInInput(event)) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === "escape") {
      event.preventDefault();
      this.clearQuestionsFilter();
      this.triggerShortcut("escape");
      return;
    }

    if (key === "f" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (this.questionsChooser && typeof this.questionsChooser.focus === "function") {
        this.questionsChooser.focus();
      }
      return;
    }

    if (key === "r") {
      event.preventDefault();
      this.loadGraph(this.dataService.startDate, this.dataService.endDate);
      this.triggerShortcut("r");
    } else if (key === "h" && this.hovered_commit != null && this.hovered_group_commit == null) {
      event.preventDefault();
      this.copyCommitHash(this.hovered_commit.url);
      this.triggerShortcut("h");
    } else if (key === "+" || key === "=" || event.code === "NumpadAdd") {
      event.preventDefault();
      this.zoomGraph(1.2);
    } else if (key === "-" || event.code === "NumpadSubtract") {
      event.preventDefault();
      this.zoomGraph(0.8);
    } else if (event.code === "Space" || key === " ") {
      event.preventDefault();
      /* Keep the hovered tooltip alive so its keycap animation is visible. */
      this.resetZoom(false, false);
      this.triggerShortcut("space");
    } else if (key === "m" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      this.focusNow(false);
      this.triggerShortcut("m");
    } else if (event.key === "ArrowLeft" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      this.navigateToNextSession(-1);
    } else if (event.key === "ArrowRight" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      this.navigateToNextSession(1);
    }
  }

  private triggerShortcut(key: string) {
    this.pressedShortcut = key;
    setTimeout(() => {
      if (this.pressedShortcut === key) this.pressedShortcut = null;
    }, 150);
  }

  private zoomGraph(factor: number) {
    this.overlayManagerService.dismissAll();
    if (!this.data_g || !this.zoom) return;
    this.data_g.transition().duration(200).call(this.zoom.scaleBy, factor);
  }

  private copyCommitHash(url: string) {
    if (!url) return;
    const hash = url.split("/").pop();
    if (hash) {
      navigator.clipboard
        .writeText(hash)
        .then(() => {
          this.toastService.copy(this.translateService.instant("TOAST.HASH_COPIED"));
        })
        .catch((err) => console.error("Could not copy text: ", err));
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.viewResizeObserver) {
      this.viewResizeObserver.disconnect();
    }
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
    if (this.zoomRafId !== null) {
      cancelAnimationFrame(this.zoomRafId);
      this.zoomRafId = null;
    }
    if (this.nowTicker) {
      clearInterval(this.nowTicker);
      this.nowTicker = null;
    }
    if (this.sessionClickTimer) {
      clearTimeout(this.sessionClickTimer);
      this.sessionClickTimer = null;
    }
    this.clearMilestoneHoverTimer();
    this.cancelMilestoneLongPress();
    MilestoneDragRenderer.stopScrollTimer(this);
    MilestoneDragRenderer.removeIndicator(this);
    document.body.style.cursor = "";
    this.unsubscribeAssignmentModified(this.assignmentsModified$);
    if (this.groupFilterSub) {
      this.groupFilterSub.unsubscribe();
    }
    document.body.style.overscrollBehaviorX = "auto";
  }

  getDisplayedRepositories(): Repository[] {
    const isFilterActive =
      (this.filterGroups && this.filterGroups.length > 0) ||
      (this.searchFilter && this.searchFilter.length > 0) ||
      (this.commitMessagesFilter && this.commitMessagesFilter.length > 0);

    return this.dataService.repositories.filter((repository) => {
      if (this.dataService.groupFilter && repository.tpGroup !== this.dataService.groupFilter) {
        return false;
      }

      if (isFilterActive) {
        return repository.commits.some((commit) => this.isCommitMatchingFilter(commit));
      }

      return true;
    });
  }

  isCommitMatchingFilter(commit: Commit): boolean {
    if (this.filterGroups && this.filterGroups.length > 0) {
      return this.filterGroups.some((group) =>
        group.criteria.every((criterion) => {
          let match = false;
          if (criterion.type === "question") {
            match = commit.question === criterion.value;
          } else {
            match = commit.message.toLowerCase().includes(criterion.value.toLowerCase());
          }
          return criterion.isExclusion ? !match : match;
        }),
      );
    }

    const hasSearchFilter = this.searchFilter.length > 0;
    const hasCommitFilter = this.commitMessagesFilter.length > 0;

    if (this.hiddenCategories.has(commit.color.label)) {
      return false;
    }
    if (this.hiddenCategories.has("CLOSING") && commit.isCloture) {
      return false;
    }
    if (this.hiddenCategories.has("COMMIT") && !commit.isCloture) {
      return false; // Wait, should this hide all non-cloture commits? Let's just use it to hide normal commits.
    }

    if (!hasSearchFilter && !hasCommitFilter) return true;

    const matchesSearch = hasSearchFilter && this.searchFilter.includes(commit.question);
    const matchesCommit =
      hasCommitFilter && this.commitMessagesFilter.some((msg) => commit.message.toLowerCase().includes(msg.toLowerCase()));

    return matchesSearch || matchesCommit;
  }

  toggleCategory(label: string) {
    if (label === "SESSION" || label === "REVIEW" || label === "CORRECTION" || label === "OTHER") {
      if (label === "SESSION") this.showSessions = !this.showSessions;
      if (label === "REVIEW") this.showReviews = !this.showReviews;
      if (label === "CORRECTION") this.showCorrections = !this.showCorrections;
      if (label === "OTHER") this.showOthers = !this.showOthers;
      this.saveMarkerPreferences();

      const currentInnerTop = this.inner_margin?.top ?? 0;
      const nextStripHeight = this.loading ? 0 : this.getTopStripHeight();

      if (currentInnerTop !== nextStripHeight) {
        this.loadGraphDataAndRefresh(true);
      } else {
        if (label === "SESSION") {
          this.loadSessionAnnotations();
        } else {
          this.loadMilestoneAnnotations();
        }
      }
      return;
    }

    if (this.hiddenCategories.has(label)) {
      this.hiddenCategories.delete(label);
    } else {
      // Prevent hiding all colors
      if (this.commitColors.find((c) => c.label === label)) {
        let hiddenColors = 0;
        this.commitColors.forEach((c) => {
          if (this.hiddenCategories.has(c.label)) hiddenColors++;
        });
        if (hiddenColors === this.commitColors.length - 1) return;
      }
      this.hiddenCategories.add(label);
    }

    this.loadGraphDataAndRefresh(true);
  }

  commit_date_format = Utils.COMMIT_DATE_FORMAT;

  hasDisplayedMilestones(): boolean {
    if (!this.dataService) return false;
    if (!this.showReviews && !this.showCorrections && !this.showOthers) {
      return false;
    }
    const milestone_filter = (m: Milestone) =>
      (!this.dataService.groupFilter || !m.tpGroup || m.tpGroup === this.dataService.groupFilter) &&
      (!this.searchFilter?.length || this.searchFilter.some((question) => m.questions?.includes(question)));

    return (
      (this.showReviews && !!this.dataService.reviews?.some(milestone_filter)) ||
      (this.showCorrections && !!this.dataService.corrections?.some(milestone_filter)) ||
      (this.showOthers && !!this.dataService.others?.some(milestone_filter))
    );
  }

  hasDisplayedSessions(): boolean {
    if (!this.dataService || !this.showSessions) return false;
    const session_filter = (s: Session) => !this.dataService.groupFilter || !s.tpGroup || s.tpGroup === this.dataService.groupFilter;
    return !!this.dataService.sessions?.some(session_filter);
  }

  getTopStripHeight(): number {
    const hasMilestones = this.hasDisplayedMilestones();
    const hasSessions = this.hasDisplayedSessions();
    if (hasMilestones && hasSessions) {
      return 48;
    } else if (hasMilestones || hasSessions) {
      return 24;
    }
    return 0;
  }

  hasTopStrip(): boolean {
    return this.getTopStripHeight() > 0;
  }

  updateVariableFromCss(): void {
    let chart_div = document.getElementById("chart");
    if (!chart_div) return;

    const stripHeight = this.loading ? 0 : this.getTopStripHeight();
    if (stripHeight === 0) {
      chart_div.classList.add("no-milestones");
      chart_div.style.setProperty("--top-inner", "0px");
    } else {
      chart_div.classList.remove("no-milestones");
      chart_div.style.setProperty("--top-inner", `${stripHeight}px`);
    }

    var style = getComputedStyle(chart_div);

    var css_var_number = (name: string, dash = true) => Number.parseInt(style.getPropertyValue((dash ? "--" : "") + name));

    let rect = chart_div.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    let maxAllowedMargin = Math.max(
      ((100 - css_var_number("chart-width-left-spacing-ratio")) * this.width) / 100,
      css_var_number("chart-width-max-left-spacing"),
    );

    let maxNameWidth = 0;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const repos = this.dataService.repositories ? this.getDisplayedRepositories() : [];

    if (context && repos.length > 0) {
      context.font = "13px " + (style.getPropertyValue("--font-family-sans") || "sans-serif");
      for (const repo of repos) {
        const displayName = this.anonymizationService.getDisplayName(repo);
        const w = context.measureText(displayName || "").width;
        if (w > maxNameWidth) maxNameWidth = w;
      }
    }

    let actualMargin = Math.min(maxNameWidth + 25, maxAllowedMargin);

    // Fallback to maxAllowedMargin if we couldn't measure
    if (maxNameWidth === 0 && repos.length > 0) {
      actualMargin = maxAllowedMargin;
    }

    this.chart_width = Math.max(1, this.width - actualMargin);

    this.inner_margin = {
      top: css_var_number("top-inner"),
      bottom: css_var_number("bottom-inner"),
    };

    this.inner_width = Math.max(1, this.chart_width);
    this.inner_height = Math.max(1, this.height - this.inner_margin.top - this.inner_margin.bottom);

    if (this.svg_abs) {
      this.svg_abs.select("#top-strip-clip rect").attr("width", this.inner_width);
    }

    this.repo_spacing = css_var_number("repo-space");
  }

  ngAfterViewInit(): void {
    this.refresh();

    setTimeout(() => {
      this.current_zoom = null;
      if (this.dataService.repoToLoad) {
        this.loadGraph(this.dataService.startDate, this.dataService.endDate);
      } else {
        this.loading = true;
        this.loadGraphMetadata(
          this.dataService.repositories,
          this.dataService.reviews,
          this.dataService.corrections,
          this.dataService.questions,
          false,
        );

        this.loading = false;
      }

      this.refreshElementState();
    });
  }

  updateLang() {
    this.typeaheadSettings = {
      tagClass: "badge badge-pill badge-secondary mr-1",
      noMatchesText: this.translateService.instant("SEARCH-NOT-FOUND"),
      suggestionLimit: 5,
    };
    this.updateSessionsTransforms();
    this.updateNowIndicator();
  }

  loadGraph(startDate?: string, endDate?: string) {
    try {
      this.loading = true;
      this.current_zoom = null;

      this.loaderService.loadRepositories(startDate, endDate).subscribe(() => {
        this.loadGraphDataAndRefresh(false);
        this.loading = false;
      });
    } catch (error) {
      this.loading = false;
    }
  }

  loadGraphData(conserveZoom: boolean = false) {
    if (!this.data_g) return;
    GraphPointsRenderer.loadPoints(this);
    this.loadAnnotations();
    ViewportRenderer.setupZoom(this, conserveZoom);
    this.updateNowIndicator();
  }

  /** Horizontal pan (and ctrl+wheel) shared by the chart body and the "now" marker. */

  /**
   * Wheel over the "now" marker must behave like the chart body: pan horizontally,
   * and forward vertical wheel to the scrollable repo list (the marker lives in a
   * separate overlay, so the native scroll would not reach it).
   */

  /**
   * Re-dispatch a shift+wheel from the "now" overlay onto the zoomed data layer so
   * the d3.zoom wheel handler (which only reacts when shiftKey is set) zooms as usual.
   */

  refresh() {
    if (!document.getElementById("chart")) return;
    this.updateVariableFromCss();
    this.scrollable_height = Math.max(
      1,
      this.height - this.inner_margin.top - this.inner_margin.bottom,
      this.getDisplayedRepositories().length * this.repo_spacing,
    );

    if (!this.viewResizeObserver && (window as any).ResizeObserver) {
      this.viewResizeObserver = new (window as any).ResizeObserver((entries: any[]) => {
        entries.forEach(() => {
          const chart_div = document.getElementById("chart");
          if (!chart_div) return;

          const newWidth = chart_div.getBoundingClientRect().width;
          const newHeight = chart_div.getBoundingClientRect().height;
          if (newWidth > 0 && (Math.abs(newWidth - (this.width || 0)) > 1 || Math.abs(newHeight - (this.height || 0)) > 1)) {
            if (this.resizeTimeout) {
              clearTimeout(this.resizeTimeout);
            }
            this.resizeTimeout = setTimeout(() => {
              this.width = chart_div.getBoundingClientRect().width;
              this.height = Math.max(
                chart_div.getBoundingClientRect().height,
                this.inner_margin.top + this.inner_margin.bottom + this.getDisplayedRepositories().length * this.repo_spacing,
              );
              this.loadGraphDataAndRefresh(true);
            }, 100);
          }
        });
      });
    }

    const chart_div = document.getElementById("chart");
    if (chart_div) {
      this.viewResizeObserver.observe(chart_div);
    }

    const container = d3.select(".chart-container");
    container.selectAll("svg").remove();
    container.selectAll(".scroll-dummy").remove();

    this.svg = container
      .append("svg")
      .attr("preserveAspectRatio", "none")
      .attr("width", this.width)
      .attr("height", this.scrollable_height)
      .attr("viewBox", `0 0 ${this.width} ${this.scrollable_height}`);

    container
      .append("div")
      .attr("class", "scroll-dummy")
      .style("width", "calc(100% + 2px)")
      .style("height", "1px")
      .style("position", "absolute")
      .style("top", "0")
      .style("left", "0")
      .style("pointer-events", "none");

    const node = container.node() as HTMLElement;
    if (node) {
      // Ensure the layout is updated before setting scrollLeft
      setTimeout(() => {
        node.scrollLeft = 1;
      }, 0);
    }

    d3.select(".chart-container-absolute").selectAll("svg").remove();
    this.svg_abs = d3
      .select(".chart-container-absolute")
      .append("svg")
      .attr("preserveAspectRatio", "none")
      .attr("width", this.width)
      .attr("height", this.height)
      .attr("viewBox", `0 0 ${this.width} ${this.height}`);

    const overview = this;

    const translation = [this.width - this.chart_width, 0];

    this.chart_svg = this.svg.append("g").attr("transform", "translate(" + translation + ")");

    this.data_g = this.chart_svg.append("g");

    this.chart_abs_g = this.svg_abs.append("g").attr("transform", "translate(" + translation + ")");
    this.now_g = null;

    d3.select(".chart-selection-container").selectAll("svg").remove();
    this.svg_selection = d3
      .select(".chart-selection-container")
      .append("svg")
      .attr("preserveAspectRatio", "none")
      .attr("width", this.width)
      .attr("height", this.height)
      .attr("viewBox", `0 0 ${this.width} ${this.height}`);

    this.chart_selection_g = this.svg_selection.append("g").attr("transform", "translate(" + translation + ")");

    this.svg_abs
      .append("defs")
      .append("svg:clipPath")
      .attr("id", "top-strip-clip")
      .append("svg:rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", this.inner_width)
      .attr("height", this.height);

    if (this.hasTopStrip() && this.inner_margin.top > 0) {
      this.chart_abs_g
        .append("rect")
        .attr("class", "milestone-strip-hitbox")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", this.inner_width)
        .attr("height", this.inner_margin.top)
        .attr("opacity", "0")
        .style("cursor", "default")
        .style("pointer-events", "all")
        .on("mousedown", (event: MouseEvent) => {
          if (event.shiftKey && event.button === 0) {
            overview.initiateShiftDragZoom(event);
          }
        })
        .on("contextmenu", (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          const rawDate = overview.getDateFromMouseEvent(event);
          const session = overview.resolveSessionAtDate(rawDate);
          if (session) {
            overview.selectAndActivateSession(session, event.pageX, event.pageY, rawDate);
          } else {
            overview.openContextMenu(event.pageX, event.pageY, rawDate);
          }
        })
        .on("click", (event: MouseEvent) => {
          if (event.shiftKey) return;
          const rawDate = overview.getDateFromMouseEvent(event);
          const session = overview.resolveSessionAtDate(rawDate);
          if (session) {
            overview.handleSessionClick(session, event.clientX, event.clientY);
          } else {
            overview.overlayManagerService.dismissAll({ blurInput: true });
          }
        })
        .on("dblclick", (event: MouseEvent) => {
          const rawDate = overview.getDateFromMouseEvent(event);
          const session = overview.resolveSessionAtDate(rawDate);
          if (session) {
            overview.handleSessionDblClick(session);
          }
        })
        .on("wheel", (event: WheelEvent) => {
          if (event.shiftKey) return;
          let dx = event.deltaX;
          let dy = event.deltaY;
          if (event.ctrlKey && Math.abs(dy) > 0 && Math.abs(dx) === 0) {
            dx = dy;
            dy = 0;
          }
          if (Math.abs(dx) > Math.abs(dy) || event.ctrlKey) {
            overview.overlayManagerService.dismissAll({ exclude: [OverlayType.SESSION_PANE] });
            event.preventDefault();
            event.stopPropagation();
            if (overview.zoom && overview.data_g) {
              overview.data_g.call(overview.zoom.translateBy, -dx / (overview.current_zoom?.k || 1), 0);
            }
          }
        });
    }

    this.data_g
      .append("rect")
      .attr("id", "data")
      .attr("width", this.inner_width)
      .attr("height", this.scrollable_height)
      .attr("opacity", "0")
      .on("mousedown", (event: MouseEvent) => {
        if (event.shiftKey && event.button === 0) {
          this.initiateShiftDragZoom(event);
        }
      })
      .on("contextmenu", (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const rawDate = this.getDateFromMouseEvent(event);
        const session = this.resolveSessionAtDate(rawDate);
        if (session) {
          this.selectAndActivateSession(session, event.pageX, event.pageY, rawDate);
        } else {
          this.openContextMenu(event.pageX, event.pageY, rawDate);
        }
      })
      .on("click", (event: MouseEvent) => {
        if (event.shiftKey) return;
        const rawDate = this.getDateFromMouseEvent(event);
        const session = this.resolveSessionAtDate(rawDate);
        if (session) {
          this.handleSessionClick(session, event.clientX, event.clientY);
        } else {
          this.overlayManagerService.dismissAll({ blurInput: true });
        }
      })
      .on("dblclick", (event: MouseEvent) => {
        const rawDate = this.getDateFromMouseEvent(event);
        const session = this.resolveSessionAtDate(rawDate);
        if (session) {
          this.handleSessionDblClick(session);
        }
      });

    d3.select(".chart-container")
      .on("mousedown", (event: MouseEvent) => {
        if (event.shiftKey && event.button === 0) {
          overview.initiateShiftDragZoom(event);
        }
      })
      .on("mousemove", function (e) {
        overview.refreshTooltip(e.clientX, e.clientY);
      })
      .on("mouseenter", () => {
        document.body.style.overscrollBehaviorX = "none";
      })
      .on("mouseleave", () => {
        document.body.style.overscrollBehaviorX = "auto";
      })
      .on("click", (event: MouseEvent) => {
        /* Any click in the chart closes the session pane; scrolling deliberately does not.
           A click on a session arms the single-click info tooltip through a 250 ms timer
           (handleSessionClick): keep TOOLTIP out of this dismissal so it is not cancelled
           before it can show, while still closing the pane and the other overlays. */
        if (event.shiftKey) return;
        const rawDate = overview.getDateFromMouseEvent(event);
        const sessionUnderCursor = !!overview.resolveSessionAtDate(rawDate);
        overview.overlayManagerService.dismissAll({
          blurInput: true,
          exclude: sessionUnderCursor ? [OverlayType.TOOLTIP] : undefined,
        });
      })
      .on("scroll", (event) => {
        overview.overlayManagerService.dismissAll({ exclude: [OverlayType.SESSION_PANE] });
        const node = event.target as HTMLElement;
        if (node && (node.scrollLeft <= 0 || node.scrollLeft >= 2)) {
          node.scrollLeft = 1;
        }
        this.refreshElementState();
      })
      .attr("tabindex", "0")
      .attr("focusable", "true");

    this.clip = this.chart_svg
      .append("defs")
      .append("svg:clipPath")
      .attr("id", "clip")
      .append("svg:rect")
      .attr("width", this.inner_width)
      .attr("height", 2 * this.scrollable_height)
      .attr("fill", "black")
      .attr("x", 0)
      .attr("y", -this.scrollable_height);
  }

  processingData = false;
  private refreshTimeout?: any;
  private pendingConserveZoom = false;

  loadGraphDataAndRefresh(conserveZoom: boolean = false) {
    if (!conserveZoom) {
      this.current_zoom = null;
      this.pendingConserveZoom = false;
    } else if (this.refreshTimeout === undefined || this.refreshTimeout === null) {
      this.pendingConserveZoom = true;
    }
    this.processingData = true;
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    this.refreshTimeout = setTimeout(() => {
      const shouldConserve = this.pendingConserveZoom;
      this.refreshTimeout = null;
      this.pendingConserveZoom = false;
      this.refresh();
      this.loadGraphData(shouldConserve);
      this.processingData = false;
    }, 0);
  }

  loadAnnotations() {
    this.loadSessionAnnotations();
    this.loadMilestoneAnnotations();
  }

  loadSessionAnnotations() {
    if (!this.data_g) return;
    if (this.session_g != null) {
      this.session_g.remove();
      this.session_g = null;
    }
    if (this.session_header_g != null) {
      this.session_header_g.remove();
      this.session_header_g = null;
    }
    if (this.filteredCommitsCount === 0) {
      return;
    }
    if (this.dataService.sessions && this.showSessions) {
      this.loadSessions();
    }
    this.updateMilestoneCutoutMask();
    if (this.now_g) {
      this.now_g.raise();
    }
  }

  loadMilestoneAnnotations() {
    if (!this.chart_abs_g) return;
    this.clearMilestoneHoverTimer();
    if (this.hovered_milestone) {
      this.hovered_milestone = undefined;
      this.tooltipService.hide();
    }
    let milestone_filter = (review: Milestone) =>
      (!this.dataService.groupFilter || !review.tpGroup || review.tpGroup === this.dataService.groupFilter) &&
      (!this.searchFilter.length || this.searchFilter.filter((question) => review.questions?.includes(question)).length);

    if (this.milestones_g != null) {
      this.milestones_g.remove();
      this.milestones_g = null;
    }
    if (this.review_g != null) {
      this.review_g.remove();
      this.review_g = null;
    }
    if (this.correction_g != null) {
      this.correction_g.remove();
      this.correction_g = null;
    }
    if (this.other_g != null) {
      this.other_g.remove();
      this.other_g = null;
    }

    if (this.filteredCommitsCount === 0) {
      this.updateMilestoneCutoutMask();
      return;
    }

    const allMilestones: { milestone: Milestone; type: string; index: number }[] = [];

    if (this.dataService.reviews && this.showReviews) {
      this.dataService.reviews.filter(milestone_filter).forEach((m, i) => {
        allMilestones.push({ milestone: m, type: "review", index: i });
      });
    }

    if (this.dataService.corrections && this.showCorrections) {
      this.dataService.corrections.filter(milestone_filter).forEach((m, i) => {
        allMilestones.push({ milestone: m, type: "correction", index: i });
      });
    }

    if (this.dataService.others && this.showOthers) {
      this.dataService.others.filter(milestone_filter).forEach((m, i) => {
        allMilestones.push({ milestone: m, type: "other", index: i });
      });
    }

    // Sort chronologically ascending: oldest first, newest last.
    // In SVG, elements rendered later in DOM are displayed on top!
    allMilestones.sort((a, b) => {
      const tA = new Date(a.milestone.date).getTime();
      const tB = new Date(b.milestone.date).getTime();
      if (tA !== tB) return tA - tB;
      return (a.milestone.label || "").localeCompare(b.milestone.label || "");
    });

    this.milestones_g = this.chart_abs_g.append("g").attr("class", "milestones-layer");

    const overview = this;
    allMilestones.forEach(({ milestone, type, index }) => {
      overview.getLineForMilestone(overview.milestones_g, milestone, `milestone ${type}`, index);
    });

    this.updateMilestoneCutoutMask();
    if (this.session_header_g) {
      this.session_header_g.raise();
    }
    if (this.now_g) {
      this.now_g.raise();
    }
  }

  isContextualMenuShown() {
    return this.contextualMenu.isContextMenuOpen();
  }

  openEditMilestoneContextMenu(review: Milestone, x: number, y: number, date: Date) {
    this.contextualMenu.close();
    this.ngZone.run(() => {
      this.contextualMenu.openEditMilestone(review, x, y, date);
    });
  }

  openEditSessionContextMenu(session: Session, x: number, y: number, date: Date) {
    this.contextualMenu.close();
    this.ngZone.run(() => {
      this.contextualMenu.openEditSession(session, x, y, date);
    });
  }

  openContextMenu(x: number, y: number, date: Date) {
    if (!this.isContextualMenuShown()) {
      this.ngZone.run(() => {
        this.contextualMenu.openNew(x, y, date);
      });
    } else {
      this.contextualMenu.close();
    }
  }

  getRelativeXFromMouseEvent(event: MouseEvent): number {
    const dataElement =
      (this.data_g?.select("#data")?.node() as SVGRectElement) || (document.getElementById("data") as unknown as SVGRectElement);
    let x = 0;
    if (dataElement) {
      const rect = dataElement.getBoundingClientRect();
      const width = rect.right - rect.left;
      if (width > 0) {
        x = ((event.clientX - rect.left) / width) * this.inner_width;
      }
    } else if (this.chart_svg && (d3 as any).pointer) {
      const [px] = (d3 as any).pointer(event, this.chart_svg.node());
      x = px;
    }
    return Math.max(0, Math.min(this.inner_width || 0, x));
  }

  getDateFromMouseEvent(event: MouseEvent): Date {
    const x = this.getRelativeXFromMouseEvent(event);
    return this.x_scale_copy ? this.x_scale_copy.invert(x) : this.x_scale ? this.x_scale.invert(x) : new Date();
  }

  onSaveMilestone(result: { oldMilestone: Milestone; newMilestone: Milestone }) {
    try {
      this.clearMilestoneHoverTimer();
      if (this.hovered_milestone) {
        this.hovered_milestone = undefined;
        this.tooltipService.hide();
      }
      const stripHeightBefore = this.getTopStripHeight();
      this.saveMilestone(result.oldMilestone, result.newMilestone);
      this.updateAfterMilestoneChange(stripHeightBefore);

      let translations = this.translateService.instant(["SUCCESS", "MILESTONE-SAVED", "MILESTONE-DELETED"]);
      this.toastService.success(
        translations["SUCCESS"],
        result.newMilestone ? translations["MILESTONE-SAVED"] : translations["MILESTONE-DELETED"],
      );
    } catch (e) {
      // toast fail
    }
  }

  saveMilestone(oldMilestone: Milestone, newMilestone: Milestone) {
    if (newMilestone) {
      this.dataService[newMilestone.type].push(newMilestone);
    }

    if (oldMilestone) {
      this.dataService[oldMilestone.type].splice(this.dataService[oldMilestone.type].indexOf(oldMilestone), 1);
    }
  }

  onSaveSession(result: { oldSession: Session; newSession: Session }) {
    try {
      if (this.hovered_session) {
        this.hovered_session = undefined;
        this.tooltipService.hide();
      }
      const stripHeightBefore = this.getTopStripHeight();
      this.saveSession(result.oldSession, result.newSession);
      this.updateAfterSessionChange(stripHeightBefore);

      let translations = this.translateService.instant(["SUCCESS", "SESSION-SAVED", "SESSION-DELETED"]);
      this.toastService.success(
        translations["SUCCESS"],
        result.newSession ? translations["SESSION-SAVED"] : translations["SESSION-DELETED"],
      );
    } catch (e) {
      // toast fail
    }
  }

  saveSession(oldSession: Session, newSession: Session) {
    if (newSession) {
      this.dataService.sessions.push(newSession);
    }

    if (oldSession) {
      this.dataService.sessions.splice(this.dataService.sessions.indexOf(oldSession), 1);
    }
  }

  onDeleteSession(session: Session) {
    try {
      if (this.hovered_session) {
        this.hovered_session = undefined;
        this.tooltipService.hide();
      }
      const stripHeightBefore = this.getTopStripHeight();
      this.deleteSession(session);
      this.updateAfterSessionChange(stripHeightBefore);

      let translations = this.translateService.instant(["SUCCESS", "SESSION-DELETED"]);
      this.toastService.success(translations["SUCCESS"], translations["SESSION-DELETED"]);
    } catch (e) {
      // toast fail
    }
  }

  onDeleteMilestone(milestone: Milestone) {
    try {
      this.clearMilestoneHoverTimer();
      if (this.hovered_milestone) {
        this.hovered_milestone = undefined;
        this.tooltipService.hide();
      }
      const stripHeightBefore = this.getTopStripHeight();
      this.deleteMilestone(milestone);
      this.updateAfterMilestoneChange(stripHeightBefore);

      let translations = this.translateService.instant(["SUCCESS", "MILESTONE-DELETED"]);
      this.toastService.success(translations["SUCCESS"], translations["MILESTONE-DELETED"]);
    } catch (e) {
      // toast fail
    }
  }

  deleteMilestone(milestone: Milestone) {
    this.dataService[milestone.type].splice(this.dataService[milestone.type].indexOf(milestone), 1);
  }

  deleteSession(session: Session) {
    this.dataService.sessions.splice(this.dataService.sessions.indexOf(session), 1);
  }

  getSessionDisplayName(session: Session): string {
    return getSessionDisplayName(session, this.dataService?.sessions || [], this.translateService);
  }

  formatSessionTime(session: Session): string {
    if (!session) return "";
    const start = moment(session.startDate);
    const end = moment(session.endDate);
    if (start.isSame(end, "day")) {
      return `${start.format("DD/MM/YYYY")} · ${start.format("HH:mm")} - ${end.format("HH:mm")}`;
    }
    return `${start.format("DD/MM/YYYY HH:mm")} - ${end.format("DD/MM/YYYY HH:mm")}`;
  }

  buildSessionBody(g: d3.Selection<any, any, any, any>, session: Session) {
    const overview = this;
    const sessionKey = overview.getSessionUid(session);

    let group = g
      .append("g")
      .datum(session)
      .attr("class", `session-container session-group-${sessionKey}`)
      .attr("clip-path", "url(#clip)")
      .on("mouseenter", () => {
        d3.selectAll(`.session-bg-${sessionKey}`).style("fill-opacity", "0.14");
        d3.selectAll(`.session-edge-${sessionKey}`).style("stroke-opacity", "0.55");
      })
      .on("mouseleave", () => {
        d3.selectAll(`.session-bg-${sessionKey}`).style("fill-opacity", null);
        d3.selectAll(`.session-edge-${sessionKey}`).style("stroke-opacity", null);
      });

    const rawX1 = this.xScaledTimeZoned(session.startDate);
    const rawX2 = this.xScaledTimeZoned(session.endDate);
    const visX1 = Math.max(0, rawX1);
    const visX2 = Math.min(this.inner_width, rawX2);
    const visWidth = Math.max(0, visX2 - visX1);

    // Tinted body background (fill only, no stroke, so no top border)
    group
      .append("rect")
      .attr("class", `session-body session-bg-${sessionKey}`)
      .attr("x", visX1)
      .attr("y", 0)
      .attr("height", this.scrollable_height)
      .attr("width", visWidth);

    // Left vertical dashed line
    group
      .append("line")
      .attr("class", `session-edge session-edge-left session-edge-${sessionKey}`)
      .attr("x1", rawX1)
      .attr("y1", 0)
      .attr("x2", rawX1)
      .attr("y2", this.scrollable_height)
      .style("display", rawX1 >= 0 && rawX1 <= this.inner_width ? "inline" : "none");

    // Right vertical dashed line
    group
      .append("line")
      .attr("class", `session-edge session-edge-right session-edge-${sessionKey}`)
      .attr("x1", rawX2)
      .attr("y1", 0)
      .attr("x2", rawX2)
      .attr("y2", this.scrollable_height)
      .style("display", rawX2 >= 0 && rawX2 <= this.inner_width ? "inline" : "none");

    this.bindSessionInteractions(group, session);
  }

  buildSessionHeader(g: d3.Selection<any, any, any, any>, session: Session, overlapGroup?: Session[]) {
    const overview = this;
    const sessionKey = overview.getSessionUid(session);

    let group = g
      .append("g")
      .datum(session)
      .attr("class", `session-header-container session-hdr-group-${sessionKey}`)
      .style("pointer-events", "auto")
      .on("mouseenter", () => {
        d3.selectAll(`.session-bg-${sessionKey}`).style("fill-opacity", "0.14");
        d3.selectAll(`.session-edge-${sessionKey}`).style("stroke-opacity", "0.55");
      })
      .on("mouseleave", () => {
        d3.selectAll(`.session-bg-${sessionKey}`).style("fill-opacity", null);
        d3.selectAll(`.session-edge-${sessionKey}`).style("stroke-opacity", null);
      });

    const rawX1 = this.xScaledTimeZoned(session.startDate);
    const rawX2 = this.xScaledTimeZoned(session.endDate);
    const visX1 = Math.max(0, rawX1);
    const visX2 = Math.min(this.inner_width, rawX2);
    const visWidth = Math.max(0, visX2 - visX1);

    const displayName = this.getSessionDisplayName(session);
    const hasNotes = !!(session.notes && session.notes.trim().length > 0);
    const groupName = session.tpGroup || "";

    /* prettier-ignore */
    // eslint-disable-next-line @typescript-eslint/quotes, max-len
    const usersSvg = '<svg style="width: 11px; height: 11px; min-width: 11px; min-height: 11px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>';

    /* prettier-ignore */
    // eslint-disable-next-line @typescript-eslint/quotes, max-len
    const calendarSvg = '<svg style="width: 11px; height: 11px; min-width: 11px; min-height: 11px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';

    /* prettier-ignore */
    // eslint-disable-next-line @typescript-eslint/quotes, max-len
    const noteSvg = '<svg style="width: 10px; height: 10px; min-width: 10px; min-height: 10px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';

    // 1. Continuous header background filling top strip behind pills
    const bgY = 0;
    const bgH = this.inner_margin.top;

    group
      .append("rect")
      .attr("class", `session-header-bg session-bg-${sessionKey}`)
      .attr("x", visX1)
      .attr("y", bgY)
      .attr("height", bgH)
      .attr("width", visWidth)
      .style("pointer-events", "auto");

    // 2. Left vertical dashed line (header)
    group
      .append("line")
      .attr("class", `session-edge session-header-edge-left session-edge-${sessionKey}`)
      .attr("x1", rawX1)
      .attr("y1", 0)
      .attr("x2", rawX1)
      .attr("y2", this.inner_margin.top)
      .style("display", rawX1 >= 0 && rawX1 <= this.inner_width ? "inline" : "none");

    // 3. Right vertical dashed line (header)
    group
      .append("line")
      .attr("class", `session-edge session-header-edge-right session-edge-${sessionKey}`)
      .attr("x1", rawX2)
      .attr("y1", 0)
      .attr("x2", rawX2)
      .attr("y2", this.inner_margin.top)
      .style("display", rawX2 >= 0 && rawX2 <= this.inner_width ? "inline" : "none");

    // 4. Top blue accent bar (above milestone labels and dashed line tops)
    group
      .append("rect")
      .attr("class", `session-header-top-bar session-bar-${sessionKey}`)
      .attr("x", visX1)
      .attr("y", bgY)
      .attr("height", 2.5)
      .attr("width", visWidth)
      .attr("rx", 1.25)
      .attr("ry", 1.25);

    // 5. Sticky foreignObject for pills
    const foX = visX1;
    const foWidth = Math.max(0, visX2 - foX);
    const foY = 0;
    const foH = 24;

    const isOverlap = !!(overlapGroup && overlapGroup.length > 1);
    const minFoWidth = isOverlap ? 74 : 55;

    const fo = group
      .append("foreignObject")
      .attr("class", "session-header-fo")
      .attr("x", foX)
      .attr("y", foY)
      .attr("width", foWidth)
      .attr("height", foH)
      .style("display", foWidth < minFoWidth ? "none" : null)
      .style("visibility", foWidth < minFoWidth ? "hidden" : "visible")
      .style("pointer-events", foWidth < minFoWidth ? "none" : "auto")
      .style("overflow", "hidden");

    SessionHeaderRenderer.renderHeader({
      session,
      overlapGroup,
      overview,
      displayName,
      groupName,
      hasNotes,
      fo,
      calendarSvg,
      usersSvg,
      noteSvg,
    });

    if (hasNotes) {
      group
        .select(".session-note-btn")
        .on("mouseenter", (e: MouseEvent) => {
          e.stopPropagation();
          const targetSession = overview.getActiveSession(session);
          overview.ngZone.run(() => {
            if (!overview.isSessionTooltipPinned) {
              overview.hovered_session = targetSession;
              overview.hovered_commit = undefined;
              overview.hovered_group_commit = undefined;
              overview.hovered_milestone = undefined;
              overview.refreshTooltip(e.clientX, e.clientY);
            }
          });
        })
        .on("mousemove", (e: MouseEvent) => {
          e.stopPropagation();
          if (overview.hovered_session && !overview.isSessionTooltipPinned) {
            overview.refreshTooltip(e.clientX, e.clientY);
          }
        })
        .on("mouseleave", (e: MouseEvent) => {
          e.stopPropagation();
          overview.ngZone.run(() => {
            if (!overview.isSessionTooltipPinned) {
              overview.hovered_session = undefined;
              overview.tooltipService.hide();
            }
          });
        })
        .on("click", (e: MouseEvent) => {
          if (e.shiftKey) return;
          e.stopPropagation();
          const targetSession = overview.getActiveSession(session);
          overview.handleSessionClick(targetSession, e.clientX, e.clientY);
        })
        .on("dblclick", (e: MouseEvent) => {
          e.stopPropagation();
          const targetSession = overview.getActiveSession(session);
          overview.handleSessionDblClick(targetSession);
        });
    }

    this.bindSessionInteractions(group, session);

    group
      .select(".session-more-btn")
      .on("mouseenter", (e: MouseEvent) => {
        e.stopPropagation();
        const targetSession = overview.getActiveSession(session);
        overview.ngZone.run(() => {
          if (!overview.isSessionTooltipPinned) {
            overview.hovered_session = targetSession;
            overview.hovered_commit = undefined;
            overview.hovered_group_commit = undefined;
            overview.hovered_milestone = undefined;
            overview.refreshTooltip(e.clientX, e.clientY);
          }
        });
      })
      .on("mousemove", (e: MouseEvent) => {
        e.stopPropagation();
        if (overview.hovered_session && !overview.isSessionTooltipPinned) {
          overview.refreshTooltip(e.clientX, e.clientY);
        }
      })
      .on("mouseleave", (e: MouseEvent) => {
        e.stopPropagation();
        overview.ngZone.run(() => {
          if (!overview.isSessionTooltipPinned) {
            overview.hovered_session = undefined;
            overview.tooltipService.hide();
          }
        });
      })
      .on("click", (e: MouseEvent) => {
        if (e.shiftKey) return;
        e.stopPropagation();
        const targetSession = overview.getActiveSession(session);
        overview.handleSessionClick(targetSession, e.clientX, e.clientY);
      })
      .on("dblclick", (e: MouseEvent) => {
        e.stopPropagation();
        const targetSession = overview.getActiveSession(session);
        overview.handleSessionDblClick(targetSession);
      });
  }

  loadSessions() {
    let loaded_sessions: Session[] = this.dataService.sessions
      .filter((session) => !this.dataService.groupFilter || !session.tpGroup || session.tpGroup === this.dataService.groupFilter)
      .slice()
      .sort((a, b) => this.compareSessions(a, b));

    this.overlapGroups = this.computeOverlapGroups(loaded_sessions);
    const newActiveIndices = new Map<string, number>();
    for (const group of this.overlapGroups) {
      if (group.length > 1) {
        const groupId = this.getGroupId(group);
        const existingIdx = this.activeSessionIndices.get(groupId);
        newActiveIndices.set(groupId, existingIdx !== undefined && existingIdx < group.length ? existingIdx : 0);
      }
    }
    if (this.lastFocusedSession) {
      for (const group of this.overlapGroups) {
        if (group.length > 1) {
          const idx = group.findIndex((s) => this.isSameSession(s, this.lastFocusedSession));
          if (idx !== -1) {
            const groupId = this.getGroupId(group);
            newActiveIndices.set(groupId, idx);
          }
        }
      }
    }
    this.activeSessionIndices = newActiveIndices;

    this.session_g = this.data_g.insert("g", () => (this.repository_g ? this.repository_g.node() : null));

    if (this.chart_abs_g) {
      const hitbox = this.chart_abs_g.select(".milestone-strip-hitbox");
      if (!hitbox.empty()) {
        this.session_header_g = this.chart_abs_g
          .insert("g", () => (hitbox.node() as Element).nextSibling as Element)
          .attr("class", "sessions-headers-group")
          .attr("clip-path", "url(#top-strip-clip)")
          .style("pointer-events", "auto");
      } else {
        this.session_header_g = this.chart_abs_g
          .append("g")
          .attr("class", "sessions-headers-group")
          .attr("clip-path", "url(#top-strip-clip)")
          .style("pointer-events", "auto");
      }
    }

    const overview = this;

    this.session_g
      .selectAll(".session-container")
      .data(loaded_sessions)
      .enter()
      .each(function (d: Session) {
        overview.buildSessionBody(d3.select(this), d);
      });

    if (this.session_header_g) {
      this.session_header_g
        .selectAll(".session-header-container")
        .data(loaded_sessions)
        .enter()
        .each(function (d: Session) {
          overview.buildSessionHeader(d3.select(this), d, overview.getSessionOverlapGroup(d));
        });
    }

    this.updateSessionsTransforms();
    this.updateSessionVisibility(true);
    if (this.session_header_g) {
      this.session_header_g.raise();
    }
  }

  /**
   * Attache les interactions communes d'une séance (zoom shift-drag, menu contextuel, clic, double
   * clic) à la sélection donnée : la bande et son en-tête partagent exactement le même câblage.
   */
  private bindSessionInteractions(selection: d3.Selection<any, any, any, any>, session: Session): void {
    const overview = this;

    selection
      .on("mousedown", (e: MouseEvent) => {
        if (e.shiftKey && e.button === 0) {
          overview.initiateShiftDragZoom(e);
        }
      })
      .on("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rawDate = overview.getDateFromMouseEvent(e);
        const targetSession = overview.resolveSessionAtDate(rawDate, session) || session;
        overview.selectAndActivateSession(targetSession, e.pageX, e.pageY, rawDate);
      })
      .on("click", (e) => {
        if (e.shiftKey) return;
        const rawDate = overview.getDateFromMouseEvent(e);
        const targetSession = overview.resolveSessionAtDate(rawDate, session) || session;
        overview.handleSessionClick(targetSession, e.clientX, e.clientY);
      })
      .on("dblclick", (e) => {
        const rawDate = overview.getDateFromMouseEvent(e);
        const targetSession = overview.resolveSessionAtDate(rawDate, session) || session;
        overview.handleSessionDblClick(targetSession);
      });
  }

  public resolveMilestoneType(m?: Milestone, g?: d3.Selection<any, any, any, any>): string {
    if (m?.type) {
      return m.type;
    }
    if (g) {
      if (g.classed("correction") || g.classed("corrections")) return "corrections";
      if (g.classed("other") || g.classed("others")) return "others";
      if (g.classed("review") || g.classed("reviews")) return "reviews";
    }
    return "reviews";
  }

  updateMilestoneCutoutMask() {
    MilestoneMaskRenderer.update(this);
  }

  readonly MILESTONE_COLOR_MAP: Record<string, string> = {
    review: "var(--color-primary)",
    reviews: "var(--color-primary)",
    correction: "var(--color-danger)",
    corrections: "var(--color-danger)",
    other: "var(--color-secondary)",
    others: "var(--color-secondary)",
  };

  getMilestoneColor(type?: string): string {
    if (!type) return "var(--color-primary)";
    const normalizedType = type.toLowerCase().trim();
    return this.MILESTONE_COLOR_MAP[normalizedType] || "var(--color-primary)";
  }

  public getEuclideanDistance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private readonly FA_ARROWS_ALT_PATH =
    // eslint-disable-next-line max-len
    "M352.201 425.775l-79.196 79.196c-9.373 9.373-24.568 9.373-33.941 0l-79.196-79.196c-15.119-15.119-4.411-40.971 16.971-40.97h51.162L228 284H127.196v51.162c0 21.382-25.851 32.09-40.971 16.971L7.029 272.937c-9.373-9.373-9.373-24.569 0-33.941L86.225 159.8c15.119-15.119 40.971-4.411 40.971 16.971V228H228V127.196h-51.23c-21.382 0-32.09-25.851-16.971-40.971l79.196-79.196c9.373-9.373 24.568-9.373 33.941 0l79.196 79.196c15.119 15.119 4.411 40.971-16.971 40.971h-51.162V228h100.804v-51.162c0-21.382 25.851-32.09 40.97-16.971l79.196 79.196c9.373 9.373 9.373 24.569 0 33.941L425.773 352.2c-15.119 15.119-40.971 4.411-40.97-16.971V284H284v100.804h51.23c21.382 0 32.09 25.851 16.971 40.971z";

  public createMilestoneLongPressBadge(g: d3.Selection<any, any, any, any>, m: Milestone): d3.Selection<any, any, any, any> {
    const badgeX = parseFloat(g.attr("data-badge-x") || "20");
    const badgeY = parseFloat(g.attr("data-badge-y") || "10");

    const badge = g.append("g").attr("class", "milestone-drag-badge").attr("transform", `translate(${badgeX}, ${badgeY})`);

    const badgeContent = badge.append("g").attr("class", "badge-content");

    // Base background circle
    badgeContent.append("circle").attr("class", "badge-bg").attr("cx", 0).attr("cy", 0).attr("r", 10);

    // Background track ring
    badgeContent.append("circle").attr("class", "badge-track").attr("cx", 0).attr("cy", 0).attr("r", 8);

    // Progress circle (r = 8, circumference = 2 * PI * 8 ~= 50.265)
    const circumference = 2 * Math.PI * 8;
    const milestoneType = this.resolveMilestoneType(m, g);
    const progressColor = this.getMilestoneColor(milestoneType);

    const progressCircle = badgeContent
      .append("circle")
      .attr("class", "badge-progress")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", 8)
      .attr("stroke", progressColor)
      .style("stroke", progressColor)
      .attr("stroke-dasharray", circumference)
      .attr("stroke-dashoffset", circumference)
      .attr("transform", "rotate(-90)");

    // 4-way move arrow icon in center (FontAwesome fa-arrows-alt)
    badgeContent
      .append("g")
      .attr("class", "badge-icon-group")
      .attr("transform", "translate(-4, -4) scale(0.015625)")
      .append("path")
      .attr("class", "badge-icon")
      .attr("d", this.FA_ARROWS_ALT_PATH)
      .attr("fill", "var(--color-text-primary)");

    // Animate circular fill over 700ms using D3 transition
    progressCircle.transition().duration(this.MILESTONE_HOLD_DURATION).ease(d3.easeLinear).attr("stroke-dashoffset", 0);

    return badge;
  }

  public cancelMilestoneLongPress() {
    if (this.activeMilestoneCleanupFn) {
      this.activeMilestoneCleanupFn();
      this.activeMilestoneCleanupFn = null;
    }
    if (this.milestoneLongPressTimer) {
      clearTimeout(this.milestoneLongPressTimer);
      this.milestoneLongPressTimer = null;
    }
    if (this.activeMilestoneBadge) {
      this.activeMilestoneBadge.remove();
      this.activeMilestoneBadge = null;
    }
    if (this.chart_abs_g) {
      this.chart_abs_g.selectAll(".milestone-drag-badge").remove();
    }
  }

  public clearMilestoneHoverTimer() {
    if (this.milestoneHoverTimer) {
      clearTimeout(this.milestoneHoverTimer);
      this.milestoneHoverTimer = null;
    }
  }

  getLineForMilestone(parent: d3.Selection<any, any, any, any>, m: Milestone, class_: string, index: number) {
    const overview = this;
    let g = parent.append("g").datum(m).attr("class", class_);

    GraphPointsRenderer.buildMilestoneGraphics(this, g, m, index);

    let x = this.xScaledTimeZoned(m.date);
    GraphPointsRenderer.setupMilestoneInteractions(this, g, m);

    let lastX = 0;
    let lastY = 0;

    return g
      .attr("transform", `translate(${x}, ${this.inner_margin.top})`)
      .call((g) => g.classed("hidden", x < 0 || x > overview.width))
      .on("mouseenter", (e) => {
        if (overview.isDraggingMilestone) return;
        lastX = e.clientX;
        lastY = e.clientY;
        overview.clearMilestoneHoverTimer();
        if (m.notes && m.notes.trim().length > 0) {
          overview.milestoneHoverTimer = setTimeout(() => {
            if (overview.isDraggingMilestone) return;
            overview.hovered_milestone = m;
            overview.hovered_commit = undefined;
            overview.hovered_group_commit = undefined;
            overview.hovered_session = undefined;
            overview.refreshTooltip(lastX, lastY);
          }, overview.MILESTONE_HOVER_DELAY);
        }
      })
      .on("mousemove", (e) => {
        if (overview.isDraggingMilestone) return;
        lastX = e.clientX;
        lastY = e.clientY;
        if (overview.hovered_milestone === m) {
          overview.refreshTooltip(e.clientX, e.clientY);
        }
      })
      .on("mouseleave", () => {
        overview.clearMilestoneHoverTimer();
        if (overview.hovered_milestone === m) {
          overview.hovered_milestone = undefined;
          overview.refreshTooltip();
        }
      })
      .on("contextmenu", (e) => {
        overview.clearMilestoneHoverTimer();
        overview.cancelMilestoneLongPress();
        if (overview.hovered_milestone) {
          overview.hovered_milestone = undefined;
          overview.tooltipService.hide();
        }
        if (overview.isDraggingMilestone) return;
        e.preventDefault();
        e.stopPropagation();
        const rawDate = overview.getDateFromMouseEvent(e);
        overview.openEditMilestoneContextMenu(m, e.pageX, e.pageY, rawDate);
      })
      .on("click", (e) => {
        if (overview.ignoreNextMilestoneClick) {
          overview.ignoreNextMilestoneClick = false;
          return;
        }
        overview.clearMilestoneHoverTimer();
        if (overview.hovered_milestone) {
          overview.hovered_milestone = undefined;
          overview.tooltipService.hide();
        }
        if (overview.isDraggingMilestone) return;
        const rawDate = overview.getDateFromMouseEvent(e);
        overview.openEditMilestoneContextMenu(m, e.pageX, e.pageY, rawDate);
      });
  }

  getCommitAuthorDisplayName(commit: Commit): string {
    return this.anonymizationService.getCommitAuthorDisplayName(commit);
  }

  refreshRepoBySplittingGroup(repo_g: any): boolean {
    let didSplit = false;
    repo_g.selectAll(".commit-group").each((commits: Commit[], i: number, nodes: any) => {
      let g = d3.select(nodes[i]);
      if (CommitGroupsRenderer.checkGroupNeedsSplit(this, commits)) {
        didSplit = true;
        CommitGroupsRenderer.splitCommitGroup(this, g, commits, repo_g);
      }
    });
    return didSplit;
  }

  private mergeCommitNodes(before: any, g: any, commits: Commit[], repo_g: any, toRemove: any[], toCommit: any[]): any {
    toRemove.push(before, g);
    let before_date = before.attr("before_date");
    let after_date = g.attr("after_date");
    let newGroup = CommitGroupsRenderer.getCommitGroupComponentFromScratch(this, repo_g, commits);
    newGroup.classed("commit", false);
    toCommit.push(newGroup);
    newGroup.attr("before_date", before_date);
    newGroup.attr("after_date", after_date);
    return newGroup;
  }

  private applyGroupDOMUpdates(repo_g: any, toRemove: any[], toCommit: any[], needsSort: boolean) {
    toRemove.forEach((g) => g.remove());
    toCommit.forEach((g) => g.classed("commit", true));

    if (toRemove.length > 0 || toCommit.length > 0 || needsSort) {
      repo_g.selectAll(".commit-group").sort((a: Commit[], b: Commit[]) => {
        let aDate = a[0] ? a[0].commitDate.getTime() : 0;
        let bDate = b[0] ? b[0].commitDate.getTime() : 0;
        return bDate - aDate;
      });
      repo_g.selectAll(".commit:not(.commit-group)").raise();
    }
  }

  refreshRepoByGrouping(repo_g: any, didSplit: boolean = false) {
    let before: any = undefined;
    let toCommit: any[] = [];
    let toRemove: any[] = [];
    let nodes = CommitGroupsRenderer.getSortedCommitNodes(this, repo_g);

    d3.selectAll(nodes).each((commit: Commit[], i: number, domNodes: any) => {
      let g = d3.select(domNodes[i]);
      if (before == null) {
        before = g;
        return;
      }
      let last_commit: Commit = before.datum()[before.datum().length - 1];
      if (CommitGroupsRenderer.shouldGroupCommit(this, last_commit, commit[0])) {
        let mergedCommits = commit.concat(before.datum());
        before = this.mergeCommitNodes(before, g, mergedCommits, repo_g, toRemove, toCommit);
      } else {
        before = g;
      }
    });

    this.applyGroupDOMUpdates(repo_g, toRemove, toCommit, didSplit);
  }

  onBrush(event) {
    // What are the selected boundaries?
    let extent = event.selection;

    // If no selection, back to initial coordinate. Otherwise, update X axis domain
    if (!extent) {
      this.x_scale_copy.domain([4, 8]);
    } else {
      this.x_scale_copy.domain([this.x_scale_copy.invert(extent[0]), this.x_scale_copy.invert(extent[1])]);
      this.brush.clear(this.svg);
    }

    // Update axis and area position
    this.x_g.transition().duration(1000).call(d3.axisBottom(this.x_scale_copy));
  }

  getOffset(_d: Date) {
    return 0;
    // return (
    //   this.x_scale_copy(d) -
    //   this.x_scale_copy(new Date(d.getTime() + d.getTimezoneOffset() * 60000))
    // );
  }

  xScaledTimeZoned(d: Date) {
    if (!d || !this.x_scale_copy) {
      return -1000;
    }

    return this.x_scale_copy(d) + this.getOffset(d);
  }

  /**
   * True unless "now" is before the assignment start or after its end.
   * Each bound is optional: a missing (or invalid) date imposes no constraint,
   * so an assignment without dates always shows the current-time marker.
   */
  isNowInAssignmentWindow(now: Date = this.clockService.now()): boolean {
    const start = this.dataService.startDate ? new Date(this.dataService.startDate) : null;
    const end = this.dataService.endDate ? new Date(this.dataService.endDate) : null;
    const t = now.getTime();

    if (start && !isNaN(start.getTime()) && t < start.getTime()) {
      return false;
    }
    if (end && !isNaN(end.getTime()) && t > end.getTime()) {
      return false;
    }
    return true;
  }

  /** Animate the viewport to a 24h window centered on the current time. */
  focusNow(dismissOverlays = true) {
    const now = this.clockService.now();
    if (!this.isNowInAssignmentWindow(now)) {
      return;
    }

    const domain = this.x_scale ? this.x_scale.domain() : null;
    const domainSpan = domain ? domain[1].getTime() - domain[0].getTime() : 0;

    /* If the whole domain already fits in 24h, a full reset shows everything. */
    if (domainSpan <= 24 * 60 * 60 * 1000) {
      this.resetZoom(false, dismissOverlays);
      return;
    }

    const halfWindow = 12 * 60 * 60 * 1000;
    this.zoomToDateRange(new Date(now.getTime() - halfWindow), new Date(now.getTime() + halfWindow), 0, dismissOverlays);
  }

  updateNowIndicator() {
    if (!this.chart_selection_g || !this.x_scale_copy) {
      return;
    }

    const now = this.clockService.now();
    if (!this.isNowInAssignmentWindow(now)) {
      this.hideNowIndicator();
      return;
    }

    const x = this.xScaledTimeZoned(now);
    if (isNaN(x) || x < 0 || x > this.inner_width) {
      this.hideNowIndicator();
      return;
    }

    this.ensureNowIndicator();

    const plotHeight = this.inner_height;
    const labelText = `${this.translateService.instant("OVERVIEW-GRAPH.NOW-LABEL")} ${formatCommitHour(now)}`;

    this.now_g.style("display", null).attr("transform", `translate(${x}, ${this.inner_margin.top})`);
    this.now_g.select(".now-line").attr("y1", 0).attr("y2", plotHeight);
    this.now_g.select(".now-hitbox").attr("y", 0).attr("height", plotHeight);

    const text = this.now_g.select(".now-pill-text");
    if (text.text() !== labelText) {
      text.text(labelText);
      const node = text.node() as SVGTextElement;
      if (node && typeof node.getBBox === "function") {
        this.nowLabelWidth = Math.max(64, node.getBBox().width + 18);
      }
    }

    const width = this.nowLabelWidth;
    const height = 18;
    /* Keep the pill inside the plot when the marker sits near the right edge. */
    let centerX = 0;
    if (x + width / 2 > this.inner_width) {
      centerX = this.inner_width - x - width / 2;
    }

    this.now_g
      .select(".now-pill-bg")
      .attr("x", centerX - width / 2)
      .attr("y", -height / 2)
      .attr("width", width)
      .attr("height", height)
      .attr("rx", height / 2)
      .attr("ry", height / 2);
    text.attr("x", centerX).attr("y", 0);

    this.raiseNowIndicator();
  }

  private ensureNowIndicator() {
    if (this.now_g && this.now_g.node() && this.now_g.node().isConnected) {
      return;
    }

    /* The selection overlay sits above the scrollable data layer, so the "now"
       marker can receive hover there (the transparent #data rect would otherwise
       swallow pointer events across the whole plot). */
    this.now_g = this.chart_selection_g.append("g").attr("class", "now-indicator").style("pointer-events", "none");
    this.now_g.on("wheel", (event: WheelEvent) => ViewportRenderer.handleNowWheel(this, event), { passive: false });

    this.now_g.append("line").attr("class", "now-line").attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 0);

    const pill = this.now_g.append("g").attr("class", "now-pill");
    const content = pill.append("g").attr("class", "now-pill-content");
    content.append("text").attr("class", "now-pill-text").attr("text-anchor", "middle").attr("dominant-baseline", "central");
    content.insert("rect", "text").attr("class", "now-pill-bg");

    const follow = (event: MouseEvent) => {
      const [, py] = d3.pointer(event, this.now_g.node());
      pill.attr("transform", `translate(0, ${py})`);
    };

    this.now_g
      .append("rect")
      .attr("class", "now-hitbox")
      .attr("x", -10)
      .attr("width", 20)
      .on("mouseenter", (event: MouseEvent) => {
        follow(event);
        this.now_g.classed("now-hover", true);
      })
      .on("mousemove", (event: MouseEvent) => follow(event))
      .on("mouseleave", () => this.now_g.classed("now-hover", false));
  }

  private raiseNowIndicator() {
    const node = this.now_g && this.now_g.node();
    if (node && node.parentNode && node.parentNode.lastElementChild !== node) {
      this.now_g.raise();
    }
  }

  private hideNowIndicator() {
    if (this.now_g) {
      this.now_g.style("display", "none");
    }
  }

  /** Called by the clock subscription / ticker; extends the domain if wall time outran it. */
  public tickNowIndicator() {
    const now = this.clockService.now();
    const domain = this.x_scale ? this.x_scale.domain() : null;
    if (domain && this.isNowInAssignmentWindow(now) && (now.getTime() > domain[1].getTime() || now.getTime() < domain[0].getTime())) {
      this.loadGraphDataAndRefresh(true);
      return;
    }
    this.updateNowIndicator();
  }

  refreshElementState() {
    this.updateNodesVisibilityAndTransforms();
    this.updateMilestoneVisibility();
    this.updateNowIndicator();

    if (!this.repositories_g) return;

    let zoomChanged = this.last_zoom_k !== (this.current_zoom ? this.current_zoom.k : 1);

    if (zoomChanged) {
      this.throttledUpdateCommitGroups();
      this.last_zoom_k = this.current_zoom ? this.current_zoom.k : 1;
    }

    this.updateConnectingLines();
    this.updateSessionsTransforms();
    this.updateMilestoneTransforms();
    this.updateDisplayModes();
  }

  private throttledUpdateCommitGroups() {
    if (this.isThrottledGroupUpdate) {
      this.needsGroupUpdate = true;
      return;
    }
    this.isThrottledGroupUpdate = true;
    this.needsGroupUpdate = false;
    CommitGroupsRenderer.updateCommitGroups(this);

    setTimeout(() => {
      this.isThrottledGroupUpdate = false;
      if (this.needsGroupUpdate) {
        this.throttledUpdateCommitGroups();
      }
    }, 100); // 100ms throttle
  }

  private updateNodesVisibilityAndTransforms() {
    if (!this.repository_g || !this.repositories_g) return;

    const overview = this;
    const padding = 100; // pixels of margin before hiding

    this.repositories_g.forEach((repo_g) => {
      repo_g.selectAll(".commit").classed("hidden", (commits: Commit[]) => {
        if (!commits || !commits[0]) return false;
        let x = overview.xScaledTimeZoned(commits[0].commitDate);
        return x < -padding || x > overview.width + padding;
      });

      repo_g.selectAll(".commit:not(.hidden)").attr("transform", (commits: Commit[]) => {
        if (!commits || !commits[0]) return "";
        return `translate(${overview.xScaledTimeZoned(commits[0].commitDate)}, 0)`;
      });

      repo_g.selectAll(".commit-group:not(.hidden)").each(function (commits: Commit[]) {
        let g = d3.select(this);
        if (overview.hiddenCategories.has("COMMIT-GROUP")) {
          g.style("display", "none");
          return;
        } else {
          g.style("display", null);
        }

        if (!commits || !commits[0]) return;
        let path = g.select("path");
        if (!path.empty()) {
          path.attr("d", CommitGroupsRenderer.getCommitGroupPathD(overview, commits[0], commits[commits.length - 1], COMMIT_GROUP_HEIGHT));
        }
      });
    });
  }

  private updateMilestoneVisibility() {
    if (!this.chart_abs_g) return;
    const overview = this;
    this.chart_abs_g.selectAll(".milestone").each(function (m: Milestone) {
      let x = overview.xScaledTimeZoned(m.date);
      d3.select(this).classed("hidden", x < 0 || x > overview.width);
    });
  }

  private updateConnectingLines() {
    const overview = this;
    this.repositories_g.forEach((g) => {
      g.selectAll(".commit_line")
        .attr("x1", function () {
          let min_d = new Date(Number.parseInt(d3.select(this).attr("min_date")));
          return Math.max(Math.min(overview.xScaledTimeZoned(min_d) || 0, overview.width), 0);
        })
        .attr("x2", function () {
          let max_d = new Date(Number.parseInt(d3.select(this).attr("max_date")));
          return Math.max(Math.min(overview.xScaledTimeZoned(max_d) || 0, overview.width), 0);
        });
    });
  }

  public updateSessionsTransforms() {
    SessionTransformsRenderer.apply(this);
  }

  private updateMilestoneTransforms() {
    this.chart_abs_g
      .selectAll(".milestone")
      .attr("transform", (m: Milestone) => `translate(${this.xScaledTimeZoned(m.date)}, ${this.inner_margin.top})`);

    this.updateMilestoneCutoutMask();
  }

  private updateDisplayModes() {
    const minMax = this.calculateGlobalMinMaxCommits();
    this.repositories_g.forEach((repo_g) => CommitGroupsRenderer.applyGroupDisplayModes(this, repo_g, minMax.min, minMax.max));
  }

  private calculateGlobalMinMaxCommits(): { min: number; max: number } {
    let maxGroupCommits = 1;
    let minGroupCommits = Number.MAX_VALUE;

    if (this.displayModes.opacity || this.displayModes.height) {
      this.repositories_g.forEach((repo_g) => {
        repo_g.selectAll(".commit-group").each(function () {
          let commits = d3.select(this).datum() as Commit[];
          if (commits && commits.length > 1) {
            if (commits.length > maxGroupCommits) maxGroupCommits = commits.length;
            if (commits.length < minGroupCommits) minGroupCommits = commits.length;
          }
        });
      });
      if (minGroupCommits === Number.MAX_VALUE) minGroupCommits = 1;
    }

    return { min: minGroupCommits, max: maxGroupCommits };
  }

  toggleDrag() {
    this.drag = !this.drag;
  }

  toggleDisplayMode(mode: "opacity" | "height" | "text") {
    this.displayModes[mode] = !this.displayModes[mode];
    this.modeHoverState[mode].wasClicked = true;
    localStorage.setItem("commitDisplayModes", JSON.stringify(this.displayModes));
    this.refreshElementState();
  }

  zoomToSession(session: Session, marginRatio = 0.1, dismissOverlays = true) {
    if (!session || !this.data_g || !this.zoom || !this.x_scale) return;
    this.hovered_commit = undefined;
    this.hovered_group_commit = undefined;
    this.hovered_g = null;
    this.tooltipService.hide();
    if (dismissOverlays) {
      this.overlayManagerService.dismissAll();
    }

    const time_domain = this.x_scale.domain();
    const minDate = time_domain[0].valueOf() as number;
    const maxDate = time_domain[1].valueOf() as number;
    const dt = maxDate - minDate;

    const startTime = session.startDate instanceof Date ? session.startDate.getTime() : new Date(session.startDate).getTime();
    const endTime = session.endDate instanceof Date ? session.endDate.getTime() : new Date(session.endDate).getTime();
    const sessionDuration = Math.max(1, endTime - startTime);

    if (isNaN(minDate) || isNaN(maxDate) || isNaN(startTime) || isNaN(endTime) || dt <= 0) return;

    const visibleRatio = Math.max(0.1, 1 - 2 * marginRatio);
    let target_k = (dt * visibleRatio) / sessionDuration;
    target_k = Math.max(1, Math.min(target_k, this.maxZoom));

    /* Toujours recentrer, même quand target_k est clamse à 1 (séance déjà aussi large
       que la fenêtre) : le zoom seul ne doit pas laisser la séance décentrée. */
    const centerTime = (startTime + endTime) / 2;
    const translate_x = this.inner_width / 2 - ((centerTime - minDate) / dt) * this.inner_width * target_k;

    const transform = d3.zoomIdentity.translate(translate_x, 0).scale(target_k);

    this.data_g.transition().duration(750).call(this.zoom.transform, transform);
  }

  handleSessionClick(session: Session, clientX: number, clientY: number) {
    if (!session) return;
    const targetSession = this.activateSession(session);

    if (this.sessionClickTimer && this.lastClickedSession === targetSession) {
      clearTimeout(this.sessionClickTimer);
      this.sessionClickTimer = null;
      this.lastClickedSession = null;
      this.isSessionTooltipPinned = false;
      this.tooltipService.hide();
      this.zoomToSession(targetSession);
      return;
    }

    if (this.sessionClickTimer) {
      clearTimeout(this.sessionClickTimer);
    }
    this.lastClickedSession = targetSession;
    this.sessionClickTimer = setTimeout(() => {
      this.sessionClickTimer = null;
      this.lastClickedSession = null;
      this.showSessionInfoTooltip(targetSession, clientX, clientY);
    }, 250);
  }

  handleSessionDblClick(session: Session) {
    if (!session) return;
    if (this.sessionClickTimer) {
      clearTimeout(this.sessionClickTimer);
      this.sessionClickTimer = null;
    }
    this.lastClickedSession = null;
    this.isSessionTooltipPinned = false;
    const targetSession = this.activateSession(session);
    this.tooltipService.hide();
    this.zoomToSession(targetSession);
  }

  /**
   * External zoom request coming from the session folder tab. The event may arrive while
   * the graph is still rebuilding after the route change, so poll briefly until the scales
   * exist instead of dropping the request.
   */
  @HostListener("window:git4school:zoom-to-session", ["$event"])
  onZoomToSessionRequested(event: CustomEvent): void {
    const session = (event as CustomEvent)?.detail?.session as Session;
    if (session) {
      this.zoomToSessionWhenReady(session);
    }
  }

  /** Session panel switcher: focus (zoom to) the selected session, without dismissing the panel. */
  @HostListener("window:git4school:focus-session", ["$event"])
  onFocusSessionRequested(event: CustomEvent): void {
    const session = (event as CustomEvent)?.detail?.session as Session;
    if (session) {
      this.zoomToSessionWhenReady(session, 0, false);
    }
  }

  private zoomToSessionWhenReady(session: Session, attempt = 0, dismissOverlays = true): void {
    if (this.data_g && this.zoom && this.x_scale) {
      const target = this.resolveSessionAtDate(session.startDate, session) || session;
      this.activateSession(target);
      this.zoomToSession(target, 0.1, dismissOverlays);
      return;
    }
    if (attempt >= 25) {
      return;
    }
    setTimeout(() => this.zoomToSessionWhenReady(session, attempt + 1, dismissOverlays), 100);
  }

  showSessionInfoTooltip(session: Session, clientX: number, clientY: number) {
    this.ngZone.run(() => {
      this.isSessionTooltipPinned = true;
      this.hovered_session = session;
      this.hovered_commit = undefined;
      this.hovered_group_commit = undefined;
      this.hovered_milestone = undefined;
      this.hovered_repository = undefined;
      this.tooltipService.showAtPosition(this.d3TooltipTemplate, clientX, clientY, "right", undefined, true);
    });
  }

  public formatSelectionDuration(d1: Date, d2: Date): string {
    return formatSelectionDuration(d1, d2);
  }

  /** Choisit et affiche la tooltip de l'élément survolé (commit, groupe, séance, jalon, dépôt). */
  public refreshTooltip(x?: number, y?: number): void {
    if (x == null || y == null) {
      return;
    }

    if (this.isSessionTooltipPinned) {
      return;
    }

    if (this.hovered_g && (this.hovered_commit || this.hovered_group_commit)) {
      const node = this.hovered_g.node();
      if (!node || !node.isConnected || this.hovered_g.select(":hover").empty()) {
        this.hovered_commit = undefined;
        this.hovered_group_commit = undefined;
        this.hovered_g = null;
        this.tooltipService.hide();
        return;
      }
    }

    if (this.hovered_commit || this.hovered_group_commit || this.hovered_session || this.hovered_milestone || this.hovered_repository) {
      this.ngZone.run(() => {
        if (!this.tooltipService.isShowing()) {
          this.tooltipService.showAtPosition(this.d3TooltipTemplate, x, y, "right", undefined, true);
        } else {
          this.tooltipService.moveTooltip(x, y, "right");
        }
      });
    } else {
      this.ngZone.run(() => {
        this.tooltipService.hide();
      });
    }
  }

  /** Délégations utilisées par le renderer des points (évite de coupler ses contrats d'hôte). */
  public setupAxis(repositories: Repository[], minDate: Date, maxDate: Date) {
    ViewportRenderer.setupAxis(this, repositories, minDate, maxDate);
  }

  public getCommitComponent(parent: d3.Selection<any, any, any, any>, commit: Commit, before?: any) {
    return CommitGroupsRenderer.getCommitComponent(this, parent, commit, before);
  }

  public startMilestoneDrag(startX: number, element: d3.Selection<any, any, any, any>, milestone: Milestone) {
    MilestoneDragRenderer.start(this, startX, element, milestone);
  }

  public updateMilestoneDrag(event: MouseEvent, element: d3.Selection<any, any, any, any>, milestone: Milestone) {
    MilestoneDragRenderer.update(this, event, element, milestone);
  }

  public endMilestoneDrag(element: d3.Selection<any, any, any, any>, hasMoved: boolean) {
    MilestoneDragRenderer.end(this, element, hasMoved);
  }

  public resetZoom(conserve?: boolean, dismissOverlays = true) {
    ViewportRenderer.resetZoom(this, conserve, dismissOverlays);
  }

  public zoomToGroup(commits: Commit[], range: number) {
    ViewportRenderer.zoomToGroup(this, commits, range);
  }

  public zoomToDateRange(startDate: Date, endDate: Date, marginRatio = 0.05, dismissOverlays = true) {
    ViewportRenderer.zoomToDateRange(this, startDate, endDate, marginRatio, dismissOverlays);
  }

  public initiateShiftDragZoom(event: MouseEvent) {
    ViewportRenderer.initiateShiftDragZoom(this, event);
  }

  getVisibleSessions(): Session[] {
    if (!this.dataService || !this.dataService.sessions) return [];
    return this.dataService.sessions
      .filter((session) => !this.dataService.groupFilter || !session.tpGroup || session.tpGroup === this.dataService.groupFilter)
      .slice()
      .sort((a, b) => this.compareSessions(a, b));
  }

  navigateToNextSession(direction: 1 | -1) {
    const sessions = this.getVisibleSessions();
    if (!sessions || sessions.length === 0) return;

    let targetSession: Session | null = null;
    let currentIndex = -1;

    if (this.lastFocusedSession) {
      currentIndex = sessions.findIndex((s) => this.isSameSession(s, this.lastFocusedSession));
    }

    if (currentIndex !== -1) {
      const nextIndex = currentIndex + direction;
      if (nextIndex >= 0 && nextIndex < sessions.length) {
        targetSession = sessions[nextIndex];
      }
    } else {
      const scale = this.x_scale_copy || this.x_scale;
      if (scale) {
        const viewportCenterTime = scale.invert(this.inner_width / 2).getTime();
        let bestDiff = Infinity;
        let bestIndex = 0;
        sessions.forEach((s, idx) => {
          const sStart = s.startDate instanceof Date ? s.startDate.getTime() : new Date(s.startDate).getTime();
          const sEnd = s.endDate instanceof Date ? s.endDate.getTime() : new Date(s.endDate).getTime();
          const centerTime = (sStart + sEnd) / 2;
          const diff = Math.abs(centerTime - viewportCenterTime);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestIndex = idx;
          }
        });
        targetSession = sessions[bestIndex];
      } else {
        targetSession = direction === 1 ? sessions[0] : sessions[sessions.length - 1];
      }
    }

    if (targetSession) {
      this.lastFocusedSession = targetSession;

      if (this.overlapGroups) {
        for (const group of this.overlapGroups) {
          const sessionIdx = group.findIndex((s) => this.isSameSession(s, targetSession));
          if (sessionIdx !== -1) {
            const groupId = this.getGroupId(group);
            this.activeSessionIndices.set(groupId, sessionIdx);
            break;
          }
        }
      }

      this.updateSessionsTransforms();
      this.updateSessionVisibility(true);
      this.zoomToSession(targetSession);
    }
  }

  searchSubmit() {
    this.loadGraphDataAndRefresh(false);
  }

  onFilterGroupsChange(groups: FilterGroup[]) {
    this.filterGroups = groups;
    this.loadGraphDataAndRefresh(false);
  }

  clearQuestionsFilter() {
    if (this.questionsChooser) {
      if (typeof this.questionsChooser.handleEscape === "function") {
        this.questionsChooser.handleEscape();
      } else {
        this.questionsChooser.clearAll();
      }
    }
  }

  openUploadFileModal() {
    let modalReference = this.modalService.open(FileChooserComponent, {});
    modalReference.result.then((assignment) => {
      assignment.id = this.dataService.assignment.id;
      this.dataService.assignment = assignment;
      this.dataService.saveData();
      this.loadGraph();
    });
  }

  updateCommitColors() {
    if (!this.repositories_g) return;

    this.repositories_g.forEach((repo_g) => {
      repo_g.selectAll(".commit:not(.commit-group)").each(function () {
        const commits = d3.select(this).datum() as Commit[];
        if (commits && commits[0]?.color) {
          d3.select(this).selectAll(".commit-normal, .commit-cloture").attr("fill", commits[0].color.color);
        }
      });

      repo_g.selectAll(".commit-group").each(function () {
        const commits = d3.select(this).datum() as Commit[];
        if (commits && commits.length > 0) {
          const lastCommit = commits[commits.length - 1];
          if (lastCommit?.color) {
            d3.select(this).select("path").attr("fill", lastCommit.color.color);
          }
        }
      });
    });
  }

  updateAfterMilestoneChange(stripHeightBefore?: number) {
    this.dataService.saveData();

    const stripHeightAfter = this.getTopStripHeight();
    if (stripHeightBefore !== undefined && stripHeightBefore !== stripHeightAfter) {
      // The top strip height changed (0 <-> 24 <-> 48), requiring layout recalculation
      this.loadGraphMetadata(
        this.dataService.repositories,
        this.dataService.reviews,
        this.dataService.corrections,
        this.dataService.questions,
        true,
      );
      return;
    }

    this.loaderService.loadCommitsMetadata(
      this.dataService.repositories,
      this.dataService.reviews,
      this.dataService.corrections,
      this.dataService.questions,
    );

    this.loadMilestoneAnnotations();
    this.updateCommitColors();
  }

  updateAfterSessionChange(stripHeightBefore?: number) {
    this.dataService.saveData();
    const stripHeightAfter = this.getTopStripHeight();
    if (stripHeightBefore !== undefined && stripHeightBefore !== stripHeightAfter) {
      // The top strip height changed (0 <-> 24 <-> 48), requiring layout recalculation
      this.loadGraphMetadata(
        this.dataService.repositories,
        this.dataService.reviews,
        this.dataService.corrections,
        this.dataService.questions,
        true,
      );
      return;
    }
    this.loadSessionAnnotations();
  }

  private buildSessionResolutionContext(): SessionResolutionContext {
    return {
      overlapGroups: this.overlapGroups,
      activeSessionIndices: this.activeSessionIndices,
      lastFocusedSession: this.lastFocusedSession,
      visibleSessions: (this.dataService.sessions || []).filter(
        (s) => !this.dataService.groupFilter || !s.tpGroup || s.tpGroup === this.dataService.groupFilter,
      ),
    };
  }

  private saveData() {
    this.updateAfterMilestoneChange();
  }

  private computeOverlapGroups(sessions: Session[]): Session[][] {
    return computeOverlapGroups(sessions, this.dataService?.tpGroups || []);
  }

  private sessionsOverlap(a: Session, b: Session): boolean {
    return sessionsOverlap(a, b);
  }

  public compareSessions(a: Session, b: Session): number {
    return compareSessions(a, b, this.dataService?.tpGroups || []);
  }

  public getSessionUid(session: Session): string {
    return this.sessionUids.uid(session);
  }

  public isSameSession(a: Session, b: Session): boolean {
    return isSameSession(a, b);
  }

  public getGroupId(group: Session[]): string {
    return getGroupId(group);
  }

  public getSessionKeyNum(session: Session): number {
    return getSessionKeyNum(session);
  }

  public getSessionOverlapGroup(session: Session): Session[] | null {
    return findOverlapGroup(this.overlapGroups, session);
  }

  public getActiveSession(session: Session): Session {
    return resolveActiveSession(session, {
      overlapGroups: this.overlapGroups,
      activeSessionIndices: this.activeSessionIndices,
    });
  }

  public sessionCoversTime(session: Session, time: number): boolean {
    return sessionCoversTime(session, time);
  }

  public resolveSessionAtDate(rawDate: Date, preferredSession?: Session): Session | null {
    return resolveSessionAtDate(rawDate, preferredSession, this.buildSessionResolutionContext());
  }

  public activateSession(session: Session): Session {
    if (!session) return session;
    const group = this.getSessionOverlapGroup(session);
    if (group && group.length > 1) {
      let index = group.indexOf(session);
      if (index === -1) {
        index = group.findIndex((s) => this.isSameSession(s, session));
      }
      if (index !== -1) {
        const groupId = this.getGroupId(group);
        if (this.activeSessionIndices.get(groupId) !== index) {
          this.activeSessionIndices.set(groupId, index);
          this.updateSessionsTransforms();
          this.updateSessionVisibility(true);
        }
      }
    }
    this.lastFocusedSession = session;
    return session;
  }

  public selectAndActivateSession(session: Session, x: number, y: number, date: Date) {
    if (!session) return;
    this.activateSession(session);
    this.openEditSessionContextMenu(session, x, y, date);
  }

  public updateSessionVisibility(shouldRaise = false) {
    if (!this.overlapGroups) return;
    const overview = this;

    if (this.session_g) {
      this.session_g.selectAll(".session-container").each(function (s: Session) {
        const g = d3.select(this);
        const group = overview.getSessionOverlapGroup(s);
        if (!group || group.length <= 1) {
          g.style("opacity", null).style("pointer-events", "auto");
          return;
        }
        const activeSession = overview.getActiveSession(s);
        const isActive = overview.isSameSession(s, activeSession);
        if (isActive) {
          g.style("opacity", null).style("pointer-events", "auto");
          if (shouldRaise) {
            g.raise();
          }
        } else {
          g.style("opacity", "0.25").style("pointer-events", "auto");
        }
      });
    }

    if (this.session_header_g) {
      this.session_header_g.selectAll(".session-header-container").each(function (s: Session) {
        const g = d3.select(this);
        const group = overview.getSessionOverlapGroup(s);
        if (!group || group.length <= 1) {
          return;
        }
        const activeSession = overview.getActiveSession(s);
        const isActive = overview.isSameSession(s, activeSession);
        const fo = g.select(".session-header-fo");
        if (!isActive) {
          g.style("display", "none").style("visibility", "hidden").style("pointer-events", "none");
          if (!fo.empty()) {
            fo.style("display", "none").style("visibility", "hidden").style("pointer-events", "none");
          }
        } else {
          if (shouldRaise) {
            g.raise();
          }
          const rawX1 = overview.xScaledTimeZoned(s.startDate);
          const rawX2 = overview.xScaledTimeZoned(s.endDate);
          const isInViewport =
            !isNaN(rawX1) && !isNaN(rawX2) && rawX2 > 0 && rawX1 < overview.inner_width && Math.max(0, rawX2 - Math.max(0, rawX1)) > 0;
          if (isInViewport) {
            g.style("display", null).style("visibility", null).style("pointer-events", "auto");
          } else {
            g.style("display", "none").style("visibility", "hidden").style("pointer-events", "none");
            if (!fo.empty()) {
              fo.style("display", "none").style("visibility", "hidden").style("pointer-events", "none");
            }
          }
        }
      });
    }
  }
}
