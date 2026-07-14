import {
  AfterViewInit,
  Component,
  ElementRef,
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
import { Commit } from "@models/Commit.model";
import { Milestone } from "@models/Milestone.model";
import { Session } from "@models/Session.model";
import { NgbModal, NgbTimeStruct } from "@ng-bootstrap/ng-bootstrap";
import { TranslateService, TranslationChangeEvent } from "@ngx-translate/core";
import { AssignmentsService } from "@services/assignments.service";
import { DataService } from "@services/data.service";
import { JsonManagerService } from "@services/json-manager.service";
import { LoaderService } from "@services/loader.service";
import { ToastService } from "@services/toast.service";
import { ThemeService } from "@services/theme.service";
import { TooltipService } from "@services/tooltip.service";
import { Subscription, concat } from "rxjs";
import { BaseGraphComponent } from "../base-graph.component";

import * as d3 from "d3";
import { Repository } from "../../../models/Repository.model";
import { tick } from "@angular/core/testing";
import { rejects } from "assert";
import { Utils } from "../../../services/utils";
import { FilterGroup } from "@components/questions-chooser/questions-chooser.component";

@Component({
  selector: "overview",
  templateUrl: "./overview.component.html",
  styleUrls: ["./overview.component.scss", "./chart.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class OverviewComponent
  extends BaseGraphComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  static formatDay = d3.timeFormat("%d/%m/%Y");
  static formatHour = d3.timeFormat("%H:%M");
  static GROUP_HEIGHT = 12;
  static CIRCLE_RADIUS = 12;

  @ViewChild(OverviewGraphContextualMenuComponent) contextualMenu;
  @ViewChild("questionsChooser") questionsChooser;
  @ViewChild("d3TooltipTemplate") d3TooltipTemplate!: TemplateRef<any>;

  minZoom: number;

  contextualMenuShown: boolean;

  assignmentsModified$: Subscription;

  displayModes = {
    opacity: false,
    height: false,
    text: false
  };

  typeaheadSettings;
  searchFilter: string[] = [];

  commitMessagesFilter: string[] = [];
  filterGroups: FilterGroup[] = [];
  filteredCommitsCount = 0;
  filteredStudentsCount = 0;
  unit = "day";
  drag = false;
  chartData = [{ data: [] }];
  showSessions = true;
  showCorrections = true;
  showReviews = true;
  showOthers = true;
  defaultSessionDuration: NgbTimeStruct;

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
  review_g: d3.Selection<any, any, any, any>;
  correction_g: d3.Selection<any, any, any, any>;
  commits_line_g: d3.Selection<any, any, any, any>;
  data_g: d3.Selection<any, any, any, any>;
  commits_g: d3.Selection<any, any, any, any>;

  x_scale: d3.ScaleTime<any, any, any>;
  x_scale_copy: d3.ScaleTime<any, any, any>; // Used by zooming
  x_axis: d3.Axis<Date | d3.NumberValue>;
  y_scale: d3.ScaleLinear<any, any, any>;
  y_axis: d3.Axis<d3.NumberValue>;

  clip: d3.Selection<any, any, any, any>;
  zoom: d3.ZoomBehavior<any, any>;

  hovered_commit: Commit;
  hovered_group_commit: Commit[];
  hovered_g: d3.Selection<any, any, any, any>;

  brush: d3.BrushBehavior<any>;
  current_zoom: any;
  chart_abs_g: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  svg_abs: d3.Selection<any, unknown, HTMLElement, any>;
  real_height: number;
  chart_width: number;
  repo_spacing: number;
  inner_width: number;
  inner_height: number;
  scrollable_height: number;
  private resizeObserver: any;
  private resizeTimeout: any;
  private last_zoom_k: number = 0;
  private zoomTimeoutId: any = null;

  isDraggingMilestone = false;
  hasMovedDuringDrag = false;
  dragScrollTimer: d3.Timer;
  dragTimeIndicator: d3.Selection<any, any, any, any>;
  ////////////////////////

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
    this.loadGraphDataAndRefresh();
  }

  constructor(
    private translateService: TranslateService,
    private toastService: ToastService,
    public jsonManager: JsonManagerService,
    public dataService: DataService,
    protected loaderService: LoaderService,
    private modalService: NgbModal,
    protected assignmentsService: AssignmentsService,
    public themeService: ThemeService,
    private tooltipService: TooltipService,
    private ngZone: NgZone
  ) {
    super(loaderService, assignmentsService, dataService);
  }

  ngOnInit(): void {
    const savedModes = localStorage.getItem('commitDisplayModes');
    if (savedModes) {
      try {
        this.displayModes = JSON.parse(savedModes);
      } catch (e) {}
    }
    
    this.defaultSessionDuration =
      this.dataService.assignment.defaultSessionDuration;
    this.contextualMenuShown = false;
    this.assignmentsModified$ = this.subscribeAssignmentModified();
    this.updateLang();
    this.translateService.onLangChange.subscribe(
      (event: TranslationChangeEvent) => {
        this.updateLang();
      }
    );
  }

  pressedShortcut: string = null;

  @HostListener("document:keydown", ["$event"])
  handleGlobalShortcuts(event: KeyboardEvent) {
    if (document.body.classList.contains("modal-open")) return;
    const target = event.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === "escape") {
      event.preventDefault();
      this.clearQuestionsFilter();
      this.triggerShortcut("escape");
    } else if (key === "r") {
      event.preventDefault();
      this.loadGraph(this.dataService.startDate, this.dataService.endDate);
      this.triggerShortcut("r");
    } else if (
      key === "c" &&
      this.hovered_commit != null &&
      this.hovered_group_commit == null
    ) {
      event.preventDefault();
      this.copyCommitHash(this.hovered_commit.url);
      this.triggerShortcut("c");
    } else if (key === "+" || key === "=" || event.code === "NumpadAdd") {
      event.preventDefault();
      this.zoomGraph(1.2);
    } else if (key === "-" || event.code === "NumpadSubtract") {
      event.preventDefault();
      this.zoomGraph(0.8);
    } else if (event.code === "Space" || key === " ") {
      event.preventDefault();
      this.resetZoom(false);
      this.triggerShortcut("space");
    }
  }

  private triggerShortcut(key: string) {
    this.pressedShortcut = key;
    setTimeout(() => {
      if (this.pressedShortcut === key) this.pressedShortcut = null;
    }, 150);
  }

  private zoomGraph(factor: number) {
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
          this.toastService.copy(
            this.translateService.instant("TOAST.HASH_COPIED")
          );
        })
        .catch((err) => console.error("Could not copy text: ", err));
    }
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.unsubscribeAssignmentModified(this.assignmentsModified$);
  }

  getDisplayedRepositories(): Repository[] {
    const isFilterActive =
      (this.filterGroups && this.filterGroups.length > 0) ||
      (this.searchFilter && this.searchFilter.length > 0) ||
      (this.commitMessagesFilter && this.commitMessagesFilter.length > 0);

    return this.dataService.repositories.filter((repository) => {
      if (
        this.dataService.groupFilter &&
        repository.tpGroup !== this.dataService.groupFilter
      ) {
        return false;
      }

      if (isFilterActive) {
        return repository.commits.some((commit) =>
          this.isCommitMatchingFilter(commit)
        );
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
            match = commit.message
              .toLowerCase()
              .includes(criterion.value.toLowerCase());
          }
          return criterion.isExclusion ? !match : match;
        })
      );
    }

    const hasSearchFilter = this.searchFilter.length > 0;
    const hasCommitFilter = this.commitMessagesFilter.length > 0;

    if (!hasSearchFilter && !hasCommitFilter) return true;

    const matchesSearch =
      hasSearchFilter && this.searchFilter.includes(commit.question);
    const matchesCommit =
      hasCommitFilter &&
      this.commitMessagesFilter.some((msg) =>
        commit.message.toLowerCase().includes(msg.toLowerCase())
      );

    return matchesSearch || matchesCommit;
  }

  commit_date_format = Utils.COMMIT_DATE_FORMAT;

  download() {
    this.assignmentsService.exportAssignment(this.dataService.assignment);
  }

  updateVariableFromCss(): void {
    let chart_div = document.getElementById("chart");
    if (!chart_div) return;

    var style = getComputedStyle(chart_div);

    var css_var_number = (name: string, dash = true) =>
      Number.parseInt(style.getPropertyValue((dash ? "--" : "") + name));

    let rect = chart_div.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    let maxAllowedMargin = Math.max(
      ((100 - css_var_number("chart-width-left-spacing-ratio")) * this.width) / 100,
      css_var_number("chart-width-max-left-spacing")
    );

    let maxNameWidth = 0;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const repos = this.dataService.repositories ? this.getDisplayedRepositories() : [];
    
    if (context && repos.length > 0) {
      context.font = "13px " + (style.getPropertyValue("--font-family-sans") || "sans-serif");
      for (const repo of repos) {
        const w = context.measureText(repo.name || "").width;
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
    this.inner_height = Math.max(
      1,
      this.height - this.inner_margin.top - this.inner_margin.bottom
    );

    this.repo_spacing = css_var_number("repo-space");
  }

  ngAfterViewInit(): void {
    this.refresh();

    setTimeout(() => {
      if (this.dataService.repoToLoad) {
        this.loadGraph(this.dataService.startDate, this.dataService.endDate);
      } else {
        this.loading = true;
        this.loadGraphMetadata(
          this.dataService.repositories,
          this.dataService.reviews,
          this.dataService.corrections,
          this.dataService.questions
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
  }

  loadGraph(startDate?: string, endDate?: string) {
    try {
      this.loading = true;

      this.loaderService.loadRepositories(startDate, endDate).subscribe(() => {
        this.loadGraphMetadata(
          this.dataService.repositories,
          this.dataService.reviews,
          this.dataService.corrections,
          this.dataService.questions
        );
        this.loading = false;
      });
    } catch (error) {
      this.loading = false;
    }
  }

  refreshTooltip(x?: number, y?: number) {
    if (x == null || y == null) {
      return;
    }

    if (this.hovered_g) {
      if (this.hovered_g.select(":hover").empty()) {
        this.hovered_commit = undefined;
        this.hovered_group_commit = undefined;
        this.hovered_g = null;
        this.tooltipService.hide();
        return;
      }
    }

    if (this.hovered_commit || this.hovered_group_commit) {
      if (!this.tooltipService.isShowing()) {
        this.tooltipService.showAtPosition(
          this.d3TooltipTemplate,
          x,
          y,
          "right",
          undefined,
          true
        );
      } else {
        this.tooltipService.moveTooltip(x, y, "right");
      }
    } else {
      this.tooltipService.hide();
    }
  }

  loadGraphData() {
    if (!this.data_g) return;
    this.loadPoints();
    this.loadAnnotations();
    this.setupZoom();
  }

  setupZoom() {
    const overview = this;
    // This line may be removed if zoom is bugged. Used to somehow make zoom works on webkit based browsers.
    d3.select(document.body).on("wheel.body", (e) => {});
    this.zoom = d3
      .zoom()
      .on("zoom", (event) => {
        if (overview.drag || !overview.x_scale) {
          return;
        }

        if (event.sourceEvent != null) {
          overview.refreshTooltip(
            event.sourceEvent.clientX,
            event.sourceEvent.clientY
          );
        }

        overview.current_zoom = event.transform;
        overview.x_scale_copy = overview.current_zoom.rescaleX(
          overview.x_scale
        );
        overview.x_g.call(this.x_axis.scale(overview.x_scale_copy));
        overview.refreshElementState();
      })
      .filter((event) => {
        return event.shiftKey || !(event instanceof WheelEvent);
      })
      .scaleExtent([0.5, overview.maxZoom]);

    this.data_g = this.data_g.call(this.zoom).on("dblclick.zoom", null);

    this.resetZoom(true);
  }

  refresh() {
    if (!document.getElementById("chart")) return;
    this.updateVariableFromCss();
    this.scrollable_height = Math.max(
      1,
      this.height - this.inner_margin.top - this.inner_margin.bottom,
      this.getDisplayedRepositories().length * this.repo_spacing
    );

    if (!this.resizeObserver && (window as any).ResizeObserver) {
      this.resizeObserver = new (window as any).ResizeObserver((entries: any[]) => {
        for (let entry of entries) {
          const chart_div = document.getElementById("chart");
          if (!chart_div) continue;
          
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
                this.inner_margin.top +
                  this.inner_margin.bottom +
                  this.getDisplayedRepositories().length * this.repo_spacing
              );
              this.loadGraphDataAndRefresh();
            }, 100);
          }
        }
      });
    }

    const chart_div = document.getElementById("chart");
    if (chart_div) {
      this.resizeObserver.observe(chart_div);
    }

    d3.select(".chart-container").selectAll("svg").remove();
    this.svg = d3
      .select(".chart-container")
      .append("svg")
      .attr("preserveAspectRatio", "none")
      .attr("width", this.width)
      .attr("height", this.scrollable_height)
      .attr("viewBox", `0 0 ${this.width} ${this.scrollable_height}`);

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

    this.chart_svg = this.svg
      .append("g")
      .attr("transform", "translate(" + translation + ")");

    this.data_g = this.chart_svg.append("g");

    this.chart_abs_g = this.svg_abs
      .append("g")
      .attr("transform", "translate(" + translation + ")");

    this.data_g
      .append("rect")
      .attr("id", "data")
      .attr("width", this.inner_width)
      .attr("height", this.scrollable_height)
      .attr("opacity", "0")
      .on("contextmenu", (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        var rect = (event.target as any).getBoundingClientRect();
        var x =
          ((event.clientX - rect.left) / (rect.right - rect.left)) *
          overview.inner_width;
        let rawDate = overview.x_scale_copy.invert(x);
        this.openContextMenu(event.pageX, event.pageY, rawDate);
      })
      .on("click", (event: MouseEvent) => {
        event.stopPropagation();
        var rect = (event.target as any).getBoundingClientRect();
        var x =
          ((event.clientX - rect.left) / (rect.right - rect.left)) *
          overview.inner_width; //x position within the element.
        let rawDate = overview.x_scale_copy.invert(x);
        this.openContextMenu(event.pageX, event.pageY, rawDate);
      });

    d3.select(".chart-container")
      .on("mousemove", function (e) {
        overview.refreshTooltip(e.clientX, e.clientY);
      })
      .on("scroll", () => this.refreshElementState())
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

  loadGraphDataAndRefresh() {
    this.processingData = true;
    setTimeout(() => {
      this.refresh();
      this.loadGraphData();
      this.processingData = false;
    }, 0);
  }

  loadAnnotations() {
    let milestone_filter = (review: Milestone) =>
      (!this.dataService.groupFilter ||
        !review.tpGroup ||
        review.tpGroup === this.dataService.groupFilter) &&
      (!this.searchFilter.length ||
        this.searchFilter.filter((question) =>
          review.questions?.includes(question)
        ).length);

    if (this.session_g != null) { this.session_g.remove(); this.session_g = null; }
    if (this.review_g != null) { this.review_g.remove(); this.review_g = null; }
    if (this.correction_g != null) { this.correction_g.remove(); this.correction_g = null; }
    if (this.other_g != null) { this.other_g.remove(); this.other_g = null; }
    
    if (this.filteredCommitsCount === 0) {
      return;
    }
    if (this.dataService.sessions && this.showSessions) {
      this.loadSessions();
    }

    if (this.dataService.reviews && this.showReviews) {
      this.loadReviews(milestone_filter);
    }

    if (this.dataService.corrections && this.showCorrections) {
      this.loadCorrections(milestone_filter);
    }

    if (this.dataService.others && this.showOthers) {
      this.loadOthers(milestone_filter);
    }
  }

  isContextualMenuShown() {
    return this.contextualMenu.isContextMenuOpen();
  }

  openEditMilestoneContextMenu(
    review: Milestone,
    x: number,
    y: number,
    date: Date
  ) {
    this.contextualMenu.close();
    this.ngZone.run(() => {
      this.contextualMenu.openEditMilestone(review, x, y, date);
    });
  }

  openEditSessionContextMenu(
    session: Session,
    x: number,
    y: number,
    date: Date
  ) {
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

  onSaveMilestone(result: {
    oldMilestone: Milestone;
    newMilestone: Milestone;
  }) {
    try {
      this.saveMilestone(result.oldMilestone, result.newMilestone);
      this.saveData();

      let translations = this.translateService.instant([
        "SUCCESS",
        "MILESTONE-SAVED",
        "MILESTONE-DELETED",
      ]);
      this.toastService.success(
        translations["SUCCESS"],
        result.newMilestone
          ? translations["MILESTONE-SAVED"]
          : translations["MILESTONE-DELETED"]
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
      this.dataService[oldMilestone.type].splice(
        this.dataService[oldMilestone.type].indexOf(oldMilestone),
        1
      );
    }
  }

  onSaveSession(result: { oldSession: Session; newSession: Session }) {
    try {
      this.saveSession(result.oldSession, result.newSession);
      this.saveData();

      let translations = this.translateService.instant([
        "SUCCESS",
        "SESSION-SAVED",
        "SESSION-DELETED",
      ]);
      this.toastService.success(
        translations["SUCCESS"],
        result.newSession
          ? translations["SESSION-SAVED"]
          : translations["SESSION-DELETED"]
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
      this.dataService.sessions.splice(
        this.dataService.sessions.indexOf(oldSession),
        1
      );
    }
  }

  onDeleteSession(session: Session) {
    try {
      this.deleteSession(session);
      this.saveData();

      let translations = this.translateService.instant([
        "SUCCESS",
        "SESSION-DELETED",
      ]);
      this.toastService.success(
        translations["SUCCESS"],
        translations["SESSION-DELETED"]
      );
    } catch (e) {
      // toast fail
    }
  }

  onDeleteMilestone(milestone: Milestone) {
    try {
      this.deleteMilestone(milestone);
      this.saveData();

      let translations = this.translateService.instant([
        "SUCCESS",
        "MILESTONE-DELETED",
      ]);
      this.toastService.success(
        translations["SUCCESS"],
        translations["MILESTONE-DELETED"]
      );
    } catch (e) {
      // toast fail
    }
  }

  deleteMilestone(milestone: Milestone) {
    this.dataService[milestone.type].splice(
      this.dataService[milestone.type].indexOf(milestone),
      1
    );
  }

  deleteSession(session: Session) {
    this.dataService.sessions.splice(
      this.dataService.sessions.indexOf(session),
      1
    );
  }

  getRectForSession(g: d3.Selection<any, any, any, any>, session: Session) {
    const overview = this;
    g.append("rect")
      .datum(session)
      .attr("class", "session")
      .attr("clip-path", "url(#clip)")
      .attr("x", 0)
      .attr("height", this.scrollable_height)
      .attr("y", 0)
      .attr(
        "width",
        this.xScaledTimeZoned(session.endDate) -
          this.xScaledTimeZoned(session.startDate)
      )
      .on("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        overview.openEditSessionContextMenu(
          session,
          e.pageX,
          e.pageY,
          overview.x_scale.invert(e.pageX)
        );
      })
      .on("click", (e) => {
        e.stopPropagation();
        overview.openEditSessionContextMenu(
          session,
          e.pageX,
          e.pageY,
          overview.x_scale.invert(e.pageX)
        );
      });
  }

  loadSessions() {
    let loaded_sessions: Session[] = this.dataService.sessions.filter(
      (session) =>
        !this.dataService.groupFilter ||
        !session.tpGroup ||
        session.tpGroup === this.dataService.groupFilter
    );

    this.session_g = this.data_g.append("g");

    const overview = this;

    setTimeout(() => {
      this.session_g
        .selectAll(".session")
        .data(loaded_sessions)
        .enter()
        .each(function (d: Session) {
          overview.getRectForSession(d3.select(this), d);
        });
    });
  }

  private buildMilestoneGraphics(g: d3.Selection<any, any, any, any>, m: Milestone, index: number) {
    // Line
    g.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 1)
      .attr("height", this.inner_height)
      .attr("transform", "translate(" + [-0.5, 0] + ")");

    // Box
    let box = g.append("rect").attr("y", 0);

    // Text
    let text = g
      .append("text")
      .attr("y", -6)
      .text(m.label || m.type.substring(0, m.type.length - 1) + " " + index)
      .attr("text-anchor", "middle");

    let bbox = text.node().getBBox();

    // Adjust for pill padding
    bbox.width += 16;
    bbox.height += 10;
    bbox.x -= 8;
    bbox.y -= 5;

    box.attr("width", bbox.width);
    box.attr("height", bbox.height);
    box.attr("x", -bbox.width / 2);
    box.attr("y", bbox.y);

    // Hitbox (transparent, plus large pour faciliter le clic)
    g.append("rect")
      .attr("class", "hitbox")
      .attr("width", bbox.width + 30)
      .attr("height", bbox.height + 30)
      .attr("x", -(bbox.width + 30) / 2)
      .attr("y", bbox.y - 15)
      .attr("style", "cursor: grab; pointer-events: all;");
  }

  private setupMilestoneDragBehavior(m: Milestone) {
    const overview = this;
    return d3.drag<any, any>()
      .on("start", function(event) {
        overview.onMilestoneDragStart(event, d3.select(this));
      })
      .on("drag", function(event) {
        overview.onMilestoneDrag(event, d3.select(this), m);
      })
      .on("end", function() {
        overview.onMilestoneDragEnd(d3.select(this));
      });
  }

  private onMilestoneDragStart(event: any, element: d3.Selection<any, any, any, any>) {
    this.isDraggingMilestone = true;
    this.hasMovedDuringDrag = false;
    element.raise();
    element.select(".hitbox").attr("style", "cursor: grabbing; pointer-events: all;");
    this.createDragTimeIndicator(event.x);
  }

  private onMilestoneDrag(event: any, element: d3.Selection<any, any, any, any>, m: Milestone) {
    this.hasMovedDuringDrag = true;
    let currentX = Math.max(0, Math.min(this.inner_width, event.x));
    
    m.date = this.x_scale_copy.invert(currentX);
    element.attr("transform", `translate(${currentX}, ${this.inner_margin.top})`);
    
    this.updateDragTimeIndicator(currentX, m.date);
    this.handleDragEdgeScrolling(currentX, element, m);
  }

  private onMilestoneDragEnd(element: d3.Selection<any, any, any, any>) {
    this.isDraggingMilestone = false;
    element.select(".hitbox").attr("style", "cursor: grab; pointer-events: all;");
    
    this.stopDragScrollTimer();
    this.removeDragTimeIndicator();

    if (this.hasMovedDuringDrag) {
      this.saveData();
      // Optional: Update tooltip position or refresh
      this.loadGraphDataAndRefresh(); // Force redraw properly to sync zoom/pan states if needed, but only if moved.
    }
  }

  private createDragTimeIndicator(x: number) {
    if (!this.axis_abs_g) return;
    
    this.dragTimeIndicator = this.axis_abs_g.append("g")
      .attr("class", "drag-time-indicator")
      .attr("transform", `translate(${x}, ${this.inner_height + this.inner_margin.top})`);
      
    // Triangle pointer
    this.dragTimeIndicator.append("path")
      .attr("d", "M -6 5 L 6 5 L 0 -1 Z")
      .attr("fill", "var(--color-surface)")
      .attr("stroke", "var(--color-border)")
      .attr("stroke-width", "1px");
      
    // Pill background
    this.dragTimeIndicator.append("rect")
      .attr("class", "pill-bg")
      .attr("x", -50)
      .attr("y", 4)
      .attr("width", 100)
      .attr("height", 24)
      .attr("rx", 12)
      .style("fill", "var(--color-surface)")
      .style("stroke", "var(--color-border)")
      .style("stroke-width", "1px")
      .style("filter", "drop-shadow(0px 2px 4px rgba(0,0,0,0.15))");
      
    this.dragTimeIndicator.append("text")
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .style("fill", "var(--color-on-surface)")
      .style("font-size", "11px")
      .style("font-weight", "600")
      .style("pointer-events", "none");
  }

  private updateDragTimeIndicator(x: number, date: Date) {
    if (!this.dragTimeIndicator) return;
    
    this.dragTimeIndicator.attr("transform", `translate(${x}, ${this.inner_height + this.inner_margin.top})`);
    
    const timeString = `${OverviewComponent.formatDay(date)} ${OverviewComponent.formatHour(date)}`;
    const textEl = this.dragTimeIndicator.select("text");
    textEl.text(timeString);

    // Dynamically adjust the pill width
    const textNode = textEl.node() as SVGTextElement;
    if (textNode) {
      const bbox = textNode.getBBox();
      const padding = 20; // 10px padding on each side
      const width = Math.max(80, bbox.width + padding); // minimum width
      this.dragTimeIndicator.select(".pill-bg")
        .attr("width", width)
        .attr("x", -width / 2);
    }
  }

  private removeDragTimeIndicator() {
    if (this.dragTimeIndicator) {
      this.dragTimeIndicator.remove();
      this.dragTimeIndicator = null;
    }
  }

  private handleDragEdgeScrolling(currentX: number, element: d3.Selection<any, any, any, any>, m: Milestone) {
    const scrollMargin = 50;
    const scrollSpeed = 5;
    let dx = 0;

    if (currentX < scrollMargin) {
      dx = scrollSpeed;
    } else if (currentX > this.inner_width - scrollMargin) {
      dx = -scrollSpeed;
    }

    if (dx !== 0) {
      if (!this.dragScrollTimer) {
        this.dragScrollTimer = d3.timer(() => this.performDragScroll(dx, element, m));
      }
    } else {
      this.stopDragScrollTimer();
    }
  }

  private performDragScroll(dx: number, element: d3.Selection<any, any, any, any>, m: Milestone) {
    if (!this.zoom || !this.data_g) return;
    
    this.data_g.call(this.zoom.translateBy, dx / (this.current_zoom?.k || 1), 0);
    
    let updatedX = this.xScaledTimeZoned(m.date);
    updatedX = Math.max(0, Math.min(this.inner_width, updatedX));
    element.attr("transform", `translate(${updatedX}, ${this.inner_margin.top})`);
    
    this.updateDragTimeIndicator(updatedX, m.date);
  }

  private stopDragScrollTimer() {
    if (this.dragScrollTimer) {
      this.dragScrollTimer.stop();
      this.dragScrollTimer = null;
    }
  }

  getLineForMilestone(
    parent: d3.Selection<any, any, any, any>,
    m: Milestone,
    class_: string,
    index: number
  ) {
    const overview = this;
    let g = parent.append("g").attr("class", class_);

    this.buildMilestoneGraphics(g, m, index);

    let x = this.xScaledTimeZoned(m.date);
    const dragBehavior = this.setupMilestoneDragBehavior(m);

    return g
      .attr("transform", `translate(${x}, ${this.inner_margin.top})`)
      .call((g) => g.classed("hidden", x < 0 || x > overview.width))
      .call(dragBehavior)
      .on("contextmenu", (e) => {
        if (overview.isDraggingMilestone) return;
        e.preventDefault();
        e.stopPropagation();
        const rawDate = overview.x_scale.invert(e.pageX);
        overview.openEditMilestoneContextMenu(m, e.pageX, e.pageY, rawDate);
      })
      .on("click", (e) => {
        if (overview.isDraggingMilestone) return;
        if (e.defaultPrevented) return; // Ignore click triggered by drag
        e.stopPropagation();
        const rawDate = overview.x_scale.invert(e.pageX);
        overview.openEditMilestoneContextMenu(m, e.pageX, e.pageY, rawDate);
      });
  }

  loadReviews(milestone_filter: (review: Milestone) => number | boolean) {
    let loaded_reviews = this.dataService.reviews.filter(milestone_filter);

    this.review_g = this.chart_abs_g.append("g");

    const overview = this;

    setTimeout(() => {
      this.review_g
        .selectAll(".review")
        .data(loaded_reviews)
        .enter()
        .each(function (d: Milestone, i) {
          overview.getLineForMilestone(
            d3.select(this),
            d,
            "milestone review",
            i
          );
        });
    });
  }

  loadCorrections(milestone_filter: (review: Milestone) => number | boolean) {
    let loaded_corrections =
      this.dataService.corrections.filter(milestone_filter);

    this.correction_g = this.chart_abs_g.append("g");

    const overview = this;

    setTimeout(() => {
      this.correction_g
        .selectAll(".correction")
        .data(loaded_corrections)
        .enter()
        .each(function (d: Milestone, i) {
          overview.getLineForMilestone(
            d3.select(this),
            d,
            "milestone correction",
            i
          );
        });
    });
  }

  loadOthers(milestone_filter: (review: Milestone) => number | boolean) {
    let loaded_other = this.dataService.others.filter(milestone_filter);

    this.other_g = this.chart_abs_g.append("g");

    const overview = this;

    setTimeout(() => {
      this.other_g
        .selectAll(".other")
        .data(loaded_other)
        .enter()
        .each(function (d: Milestone, i) {
          overview.getLineForMilestone(
            d3.select(this),
            d,
            "milestone other",
            i
          );
        });
    });
  }

  setupAxis(repositories: Repository[], minDate: Date, maxDate: Date) {
    if (this.axis_g != null) this.axis_g.remove();
    const overview = this;

    this.x_scale = d3
      .scaleTime()
      .domain([minDate, maxDate])
      .range([0, this.inner_width]);

    this.x_scale_copy = this.x_scale.copy();

    this.x_axis = d3
      .axisBottom(this.x_scale_copy)
      .ticks(6)
      .tickSize(-this.inner_height);

    this.x_axis.tickFormat(function (d) {
      if (!(d instanceof Date)) return "";
      let ticks = overview.x_scale_copy.ticks();
      if (ticks[ticks.length - 1] == null || ticks[0] == null) return "";
      let spacing =
        (ticks[ticks.length - 1].getTime() - ticks[0].getTime()) / 1000;

      return OverviewComponent.multiFormat(spacing, d);
    });

    this.axis_g = this.chart_svg.insert("g", ":first-child");
    this.axis_abs_g = this.chart_abs_g.insert("g", ":first-child");

    this.x_g = this.axis_abs_g
      .append("g")
      .attr(
        "transform",
        "translate(" + [0, this.inner_height + this.inner_margin.top] + ")"
      )
      .call(this.x_axis);

    this.y_scale = d3
      .scaleLinear()
      .domain([0, repositories.length + 1])
      .range([0, this.scrollable_height]);

    this.y_axis = d3
      .axisLeft(this.y_scale)
      .tickValues([...Array(repositories.length + 1).keys()])
      .tickFormat((d) => {
        return repositories[d.valueOf() - 1]?.name || "";
      })
      .tickSize(-this.inner_width);

    if (this.y_g != null) this.y_g.remove();
    this.y_g = this.axis_g.append("g").call(this.y_axis);

    // Hide the first tick use to prevent data from being placed on top of the chart
    this.y_g.select(".tick:first-of-type").attr("opacity", "0");

    // Set repo_name class, align to left, and use custom tooltip
    const leftSpace = this.width - this.chart_width;
    const leftX = -leftSpace + 5;
    
    this.y_g
      .selectAll(".tick")
      .selectAll("text")
      .call((g) => g.classed("repo_name", true))
      .attr("text-anchor", "start")
      .attr("x", leftX)
      .each(function (this: SVGTextElement) {
        const maxW = leftSpace - 15;
        let textStr = this.textContent || "";
        
        // Initial check if it exceeds width
        if (this.getComputedTextLength() > maxW && textStr.length > 0) {
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (context) {
            let style = window.getComputedStyle(this);
            context.font = style.fontSize + " " + style.fontFamily;
            
            let i = textStr.length;
            while (context.measureText(textStr.substring(0, i) + "...").width > maxW && i > 0) {
              i--;
            }
            this.textContent = textStr.substring(0, i) + "...";
          } else {
            // Fallback just in case canvas is not supported
            let i = textStr.length;
            while (this.getComputedTextLength() > maxW && i > 0) {
              this.textContent = textStr.substring(0, i) + "...";
              i--;
            }
          }
        }
      })
      .on("mouseenter", function (event: MouseEvent, d: any) {
        event.stopPropagation();
        const repo = repositories[d.valueOf() - 1];
        if (repo?.name) {
          overview.tooltipService.showAtPosition(
            repo.name,
            event.clientX,
            event.clientY,
            "right"
          );
        }
      })
      .on("mousemove", function (event: MouseEvent) {
        event.stopPropagation();
        if (overview.tooltipService.isShowing()) {
          overview.tooltipService.moveTooltip(event.clientX, event.clientY, "right");
        }
      })
      .on("mouseleave", function (event: MouseEvent) {
        event.stopPropagation();
        overview.tooltipService.hide();
      });

    // Use custom domain
    this.axis_abs_g.selectAll(".domain").style("opacity", "0");
    this.axis_g.selectAll(".domain").style("opacity", "0");

    this.axis_g
      .append("g")
      .attr("class", "axis")
      .append("line")
      .attr("x1", 0)
      .attr("x2", 0)
      .attr("y1", 0)
      .attr("y2", this.scrollable_height);

    this.axis_g
      .append("g")
      .attr("class", "axis")
      .append("line")
      .attr("x1", 0)
      .attr("x2", this.inner_width)
      .attr("y1", this.scrollable_height)
      .attr("y2", this.scrollable_height);
  }

  getCommitGroupPathD(first: Commit, last: Commit, height: number = OverviewComponent.GROUP_HEIGHT) {
    let begin_x = this.xScaledTimeZoned(first.commitDate);
    let end_x = this.xScaledTimeZoned(last.commitDate);
    
    let actualWidth = end_x - begin_x;
    let minWidth = 10; // Reduced from 14
    let width = Math.max(actualWidth, minWidth);
    
    let arcRadius = height / 2;
    let extraWidth = last.isCloture ? arcRadius : 0;
    
    // Centers the visual shape (including the arc) over the actual commit span.
    let visualWidth = width + extraWidth;
    let offset = (actualWidth - visualWidth) / 2;

    if (last.isCloture) {
      return `M ${offset} 0 h ${width} a ${arcRadius} ${arcRadius} 0 0 1 0 ${height} H ${offset} z`;
    } else {
      return `M ${offset} 0 h ${width} v ${height} H ${offset} z`;
    }
  }

  getCommitGroupComponentFromScratch(
    parent: d3.Selection<any, Repository, any, any>,
    commits: Commit[]
  ): d3.Selection<any, Commit[], any, any> {
    let sorted = commits.sort(
      (a, b) => a.commitDate.getTime() - b.commitDate.getTime()
    );

    let g = parent.insert("g", ".commit:not(.commit-group)").datum(sorted);

    let begin_x = this.xScaledTimeZoned(sorted[0].commitDate);
    let end_x = this.xScaledTimeZoned(sorted[sorted.length - 1].commitDate);

    g.attr("class", "commit-group commit")
      .append("path")
      .attr("d", this.getCommitGroupPathD(sorted[0], sorted[sorted.length - 1], OverviewComponent.GROUP_HEIGHT))
      .style("--y-offset", `${-OverviewComponent.GROUP_HEIGHT / 2}px`)
      .attr("fill", sorted[sorted.length - 1].color.color)
      .attr("class", "data");

    let range = 0;
    for (let i = 0; i < commits.length - 1; i++) {
      range = Math.max(
        range,
        commits[i + 1].commitDate.getTime() - commits[i].commitDate.getTime()
      );
    }

    g.attr("group_range", range);
    g.attr("transform", `translate(${begin_x}, 0)`)
      .on("mouseenter", (e, d) => {
        this.hovered_commit = undefined;
        this.hovered_group_commit = d;
        this.hovered_g = g;
      })
      .on("mouseleave", () => {
        if (this.hovered_g === g) {
          this.hovered_g = undefined;
          this.hovered_group_commit = undefined;
        }
      })
      .on("click", (e, d) => {
        e.stopPropagation();
        let currentRange = parseFloat(g.attr("group_range")) || 0;
        this.zoomToGroup(d, currentRange);
      });

    return g;
  }

  getCommitGroupComponent(
    parent: d3.Selection<any, Repository, any, any>,
    group: d3.Selection<any, Commit[], any, any> | undefined,
    commit: Commit
  ): d3.Selection<any, any, any, any> {
    let g;

    if (group == null) {
      let x = this.xScaledTimeZoned(commit.commitDate);

      g = parent.insert("g", ".commit:not(.commit-group)").datum([commit]);

      g.attr("class", "commit-group")
        .append("path")
        .attr("d", this.getCommitGroupPathD(commit, commit, OverviewComponent.GROUP_HEIGHT))
        .style("--y-offset", `${-OverviewComponent.GROUP_HEIGHT / 2}px`)
        .attr("fill", commit.color.color)
        .attr("class", "data")
        .on("mouseenter", (e, d) => (this.hovered_group_commit = d))
        .on("mouseleave", () => {
          this.hovered_group_commit = undefined;
        });

      g.on("click", (e, d) => {
        e.stopPropagation();
        let currentRange = parseFloat(g.attr("group_range")) || 0;
        this.zoomToGroup(d, currentRange);
      });

      g.attr("transform", `translate(${x}, 0)`);
    } else {
      if (group.select("path").empty()) {
        let group_commit = group.datum()[0];
        let before_date = group.attr("before_date");
        let after_date = group.attr("after_date");
        group.remove();
        group = this.getCommitGroupComponent(parent, undefined, group_commit);
        group.attr("before_date", before_date);
        group.attr("after_date", after_date);
      }

      g = group;
      let all_commits = group
        .datum()
        .concat(commit)
        .sort((a, b) => a.commitDate.getTime() - b.commitDate.getTime());
      let spacing = Number.MAX_VALUE;
      let j = all_commits.indexOf(commit);
      if (j < all_commits.length - 1)
        spacing = Math.min(
          Math.abs(
            all_commits[j + 1].commitDate.getTime() -
              commit.commitDate.getTime()
          ),
          spacing
        );
      if (j > 0)
        spacing = Math.min(
          Math.abs(
            all_commits[j - 1].commitDate.getTime() -
              commit.commitDate.getTime()
          ),
          spacing
        );

      group.datum(all_commits);

      let begin_x = this.xScaledTimeZoned(all_commits[0].commitDate);
      let end_x = this.xScaledTimeZoned(
        all_commits[all_commits.length - 1].commitDate
      );

      g.select("path")
        .attr(
          "d",
          this.getCommitGroupPathD(
            all_commits[0],
            all_commits[all_commits.length - 1],
            OverviewComponent.GROUP_HEIGHT
          )
        )
        .style("--y-offset", `${-OverviewComponent.GROUP_HEIGHT / 2}px`)
        .attr("fill", all_commits[all_commits.length - 1].color.color);

      g.attr("group_range", Math.max(spacing, g.attr("group_range") || 0));
      g.attr("transform", `translate(${begin_x}, 0)`);
    }

    return g;
  }

  getCommitSimpleComponent(
    parent: d3.Selection<any, Repository, any, any>,
    commit: Commit
  ): d3.Selection<any, Commit[], any, any> {
    let g = parent.append("g").datum([commit]);

    g.classed("simple-commit", true);

    let x = this.xScaledTimeZoned(commit.commitDate);

    let comp: d3.Selection<any, any, any, any> = g
      .append("a")
      .attr("href", (d) => d[0].url)
      .attr("target", "_blank");

    if (commit.isCloture) {
      comp = comp.append("circle").attr("class", "commit-cloture");
    } else {
      comp = comp.append("rect").attr("class", "commit-normal");
    }

    comp.attr("fill", commit.color.color);
    g.attr("date", (commit.commitDate as Date).getTime());

    g.attr("transform", `translate(${x}, 0)`)
      .on("mouseenter", () => {
        this.hovered_commit = commit;
        this.hovered_group_commit = undefined;
        this.hovered_g = undefined;
      })
      .on("mouseleave", () => {
        if (
          this.hovered_commit &&
          this.hovered_commit.commitDate === commit.commitDate
        ) {
          this.hovered_commit = undefined;
        }
      });

    return g;
  }

  shouldGroupCommit(commit_before: Commit, commit_after: Commit): boolean {
    return (
      !commit_before.isCloture &&
      this.xScaledTimeZoned(commit_after.commitDate) -
        this.xScaledTimeZoned(commit_before.commitDate) <
        Utils.COMMIT_FUSE_RANGE
    );
  }

  getCommitComponent(
    parent: d3.Selection<any, Repository, any, any>,
    commit: Commit,
    before: d3.Selection<any, Commit[], any, any>
  ): d3.Selection<any, Commit[], any, any> {
    let should_be_grouped_with_last =
      before != null &&
      this.shouldGroupCommit(before.datum()[before.datum().length - 1], commit);

    let g: d3.Selection<any, any, any, any>;

    const time = commit.commitDate.getTime();
    if (!should_be_grouped_with_last) {
      g = this.getCommitSimpleComponent(parent, commit);
      if (before != null) {
        g.attr("before_date", before.attr("end_date") || before.attr("date"));
      }
      g.attr("after_date", time);
    } else {
      g = this.getCommitGroupComponent(parent, before, commit);
      g.attr("end_date", time);
    }

    g.classed("commit", true);

    return g;
  }

  static multiFormat(spacing: number, date: Date) {
    const options: Intl.NumberFormatOptions = {
      useGrouping: false,
      minimumIntegerDigits: 2,
    };

    if (spacing > 24 * 3600)
      return `${date.getDate().toLocaleString(undefined, options)}/${(
        date.getMonth() + 1
      ).toLocaleString(undefined, options)}/${date
        .getFullYear()
        .toLocaleString(undefined, options)}`;
    else
      return `${date.getHours().toLocaleString(undefined, options)}:${date
        .getMinutes()
        .toLocaleString(undefined, options)}`;
  }

  loadPoints() {
    const overview = this;
    const repositories: Repository[] = this.getDisplayedRepositories();

    if (this.repository_g != null) this.repository_g.remove();

    overview.filteredCommitsCount = 0;
    overview.filteredStudentsCount = 0;

    let allCommits = repositories
      .map((v) => v.commits)
      .reduce((a, b) => a.concat(b), []);
      
    if (repositories.length === 0) {
      if (this.axis_g != null) {
        this.axis_g.remove();
        this.axis_g = null;
      }
      return;
    }

    this.repository_g = this.data_g.append("g");
    this.repositories_g = new Array<any>(repositories.length);
    
    let minDate: Date, maxDate: Date;
    
    if (allCommits.length === 0) {
      minDate = this.dataService.startDate ? new Date(this.dataService.startDate) : new Date(Date.now() - 7 * 24 * 3600 * 1000);
      maxDate = this.dataService.endDate ? new Date(this.dataService.endDate) : new Date();
      if (minDate > maxDate) {
        const temp = minDate;
        minDate = maxDate;
        maxDate = temp;
      }
    } else {
      let ext = d3.extent(allCommits, (d) => d.commitDate);
      minDate = ext[0];
      maxDate = ext[1];
    }
    
    // Add 2% padding to the graph's time domain so elements don't touch the edges
    if (minDate && maxDate) {
      let timeDiff = maxDate.getTime() - minDate.getTime();
      if (timeDiff === 0) timeDiff = 24 * 3600 * 1000; // 1 day minimum span
      let padding = timeDiff * 0.02;
      minDate = new Date(minDate.getTime() - padding);
      maxDate = new Date(maxDate.getTime() + padding);
    }

    this.setupAxis(repositories, minDate, maxDate);

    this.maxZoom = (maxDate.getTime() - minDate.getTime()) / (1000 * 60);

    this.repository_g
      .selectAll(".repository")
      .data(repositories)
      .enter()
      .append("g")
      .each(function (repository: Repository, i: number) {
        overview.repositories_g[i] = d3.select(this);
        overview.repositories_g[i].classed("repository", true);
        overview.repositories_g[i]
          .attr("repository_index", i)
          .attr("transform", `translate(0, ${overview.y_scale(i + 1)})`);

        let before = undefined;
        let commits = repository.commits
          .filter((commit) => overview.isCommitMatchingFilter(commit))
          .sort((a, b) => a.commitDate.getTime() - b.commitDate.getTime());

        overview.filteredCommitsCount += commits.length;
        if (commits.length > 0) {
          overview.filteredStudentsCount++;

          let minDateTime: number, maxDateTime: number;

          let lines = [];
          let current_line: Commit | undefined = undefined;

          commits.forEach((commit) => {
            minDateTime =
              minDateTime == null
                ? commit.commitDate.getTime()
                : Math.min(commit.commitDate.getTime(), minDateTime);
            maxDateTime =
              maxDateTime == null
                ? commit.commitDate.getTime()
                : Math.max(commit.commitDate.getTime(), maxDateTime);
            if (commit.message === "Resume") current_line = commit;
            else if (commit.message === "Pause" && current_line) {
              lines.push([current_line.commitDate, commit.commitDate]);
              current_line = undefined;
            }
            before = overview.getCommitComponent(d3.select(this), commit, before);
          });

          if (lines.length === 0) {
            lines.push([new Date(minDateTime), new Date(maxDateTime)]);
          }

          lines.forEach(([d1, d2]) => {
            overview.repositories_g[i]
              .insert("line", ":first-child")
              .attr("class", "commit_line")
              .attr("min_date", d1.getTime())
              .attr("max_date", d2.getTime());
          });
        }
      });
  }

  refreshRepoBySplittingGroup(repo_g) {
    const overview = this;
    let didSplit = false;
    repo_g.selectAll(".commit-group").each(function () {
      let g = d3.select(this);
      let commits = g.datum() as Commit[];
      
      let needsSplit = false;
      for (let i = 0; i < commits.length - 1; i++) {
        if (!overview.shouldGroupCommit(commits[i], commits[i+1])) {
          needsSplit = true;
          break;
        }
      }

      if (needsSplit) {
        didSplit = true;
        if (overview.hovered_g === g) {
          overview.hovered_g = undefined;
          overview.hovered_group_commit = undefined;
        }
        let before = undefined;
        g.remove();
        commits.forEach((commit) => {
          before = overview.getCommitComponent(repo_g, commit, before);
        });
      }
    });
    return didSplit;
  }

  refreshRepoByGrouping(repo_g, didSplit: boolean = false) {
    const overview = this;
    let before = undefined;
    let toCommit = [];
    let toRemove = [];

    let nodes = repo_g.selectAll(".commit").nodes();
    nodes.sort((a: any, b: any) => {
      let aDatum = d3.select(a).datum() as Commit[];
      let bDatum = d3.select(b).datum() as Commit[];
      return aDatum[0].commitDate.getTime() - bDatum[0].commitDate.getTime();
    });

    d3.selectAll(nodes).each(function (commit: Commit[]) {
      let g: d3.Selection<any, Commit[], any, any> = d3.select(this);

        if (before == null) {
          before = g;
          return;
        }

        let last_commit: Commit = before.datum()[before.datum().length - 1];
        if (overview.shouldGroupCommit(last_commit, commit[0])) {
          let commits = commit.concat(before.datum());
          toRemove.push(before, g);

          let before_date = before.attr("before_date");
          let after_date = g.attr("after_date");
          before = overview.getCommitGroupComponentFromScratch(repo_g, commits);
          before.classed("commit", false);
          toCommit.push(before);
          before.attr("before_date", before_date);
          before.attr("after_date", after_date);
        } else before = g;
      });

    toRemove.forEach((g) => g.remove());
    toCommit.forEach((g) => g.classed("commit", true));

    let changed = toRemove.length > 0 || toCommit.length > 0;
    if (changed || didSplit) {
      // Sort commit groups so right groups (higher date) are drawn first, and left groups on top
      repo_g.selectAll(".commit-group").sort((a: Commit[], b: Commit[]) => {
        let aDate = a[0] ? a[0].commitDate.getTime() : 0;
        let bDate = b[0] ? b[0].commitDate.getTime() : 0;
        return bDate - aDate;
      });

      // Ensure individual commits stay on top of everything
      repo_g.selectAll(".commit:not(.commit-group)").raise();
    }
  }

  onBrush(event) {
    // What are the selected boundaries?
    let extent = event.selection;

    // If no selection, back to initial coordinate. Otherwise, update X axis domain
    if (!extent) {
      this.x_scale_copy.domain([4, 8]);
    } else {
      this.x_scale_copy.domain([
        this.x_scale_copy.invert(extent[0]),
        this.x_scale_copy.invert(extent[1]),
      ]);
      this.brush.clear(this.svg);
    }

    // Update axis and area position
    this.x_g.transition().duration(1000).call(d3.axisBottom(this.x_scale_copy));
  }

  getOffset(d: Date) {
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

  refreshElementState() {
    this.updateNodesVisibilityAndTransforms();
    this.updateMilestoneVisibility();

    if (!this.repositories_g) return;

    let zoomChanged = this.last_zoom_k !== (this.current_zoom ? this.current_zoom.k : 1);
    
    if (zoomChanged) {
      this.updateCommitGroups();
      this.last_zoom_k = this.current_zoom ? this.current_zoom.k : 1;
    }
    
    this.updateConnectingLines();
    this.updateSessionsTransforms();
    this.updateMilestoneTransforms();
    this.updateDisplayModes();
  }

  private updateNodesVisibilityAndTransforms() {
    if (!this.repository_g) return;
    
    const containerRect = (d3.select(".chart-container") as any).node().getBoundingClientRect();
    
    this.repositories_g.forEach((repo_g) => {
      repo_g.selectAll(".commit").each(function () {
        let nodeRect = (repo_g.node() as any).getBoundingClientRect();
        const nodeVisible =
          nodeRect.right >= containerRect.left && nodeRect.left <= containerRect.right &&
          nodeRect.bottom >= containerRect.top && nodeRect.top <= containerRect.bottom;
        d3.select(this).classed("hidden", !nodeVisible);
      });

      repo_g.selectAll(".commit:not(.hidden)").attr("transform", (commits: Commit[]) =>
        `translate(${this.xScaledTimeZoned(commits[0].commitDate)}, 0)`
      );

      const overview = this;
      repo_g.selectAll(".commit-group:not(.hidden)").each(function(commits: Commit[]) {
        let g = d3.select(this);
        let path = g.select("path");
        if (!path.empty()) {
          path.attr("d", overview.getCommitGroupPathD(commits[0], commits[commits.length - 1], OverviewComponent.GROUP_HEIGHT));
        }
      });
    });
  }

  private updateMilestoneVisibility() {
    const overview = this;
    this.chart_abs_g.selectAll(".milestone").each(function (m: Milestone) {
      let x = overview.xScaledTimeZoned(m.date);
      d3.select(this).classed("hidden", x < 0 || x > overview.width);
    });
  }

  private updateCommitGroups() {
    this.repositories_g.forEach((repo_g) => {
      let split = this.refreshRepoBySplittingGroup(repo_g);
      this.refreshRepoByGrouping(repo_g, split);
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

  private updateSessionsTransforms() {
    if (!this.session_g) return;
    this.session_g.selectAll(".session")
      .attr("x", (s: Session) => this.xScaledTimeZoned(s.startDate))
      .attr("width", (s: Session) => this.xScaledTimeZoned(s.endDate) - this.xScaledTimeZoned(s.startDate));
  }

  private updateMilestoneTransforms() {
    this.chart_abs_g.selectAll(".milestone")
      .attr("transform", (m: Milestone) =>
        `translate(${this.xScaledTimeZoned(m.date)}, ${this.inner_margin.top})`
      );
  }

  private updateDisplayModes() {
    const minMax = this.calculateGlobalMinMaxCommits();
    this.repositories_g.forEach((repo_g) => this.applyGroupDisplayModes(repo_g, minMax.min, minMax.max));
  }

  private calculateGlobalMinMaxCommits(): { min: number, max: number } {
    let maxGroupCommits = 1;
    let minGroupCommits = Number.MAX_VALUE;
    
    if (this.displayModes.opacity || this.displayModes.height) {
      this.repositories_g.forEach((repo_g) => {
        repo_g.selectAll(".commit-group").each(function() {
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

  private applyGroupDisplayModes(repo_g: any, minGroupCommits: number, maxGroupCommits: number) {
    const overview = this;
    repo_g.selectAll(".commit-group:not(.hidden)").each(function() {
      let g = d3.select(this);
      let commits = g.datum() as Commit[];
      if (commits.length <= 1) return;

      let height = overview.getGroupHeight(commits.length, minGroupCommits, maxGroupCommits);
      let opacity = overview.getGroupOpacity(commits.length, minGroupCommits, maxGroupCommits);
      
      overview.updateGroupPath(g, commits, height);
      overview.updateGroupText(g, commits);
      
      g.attr("opacity", overview.displayModes.opacity ? opacity : 1.0);
    });
  }

  private getGroupHeight(count: number, min: number, max: number): number {
    if (!this.displayModes.height) return OverviewComponent.GROUP_HEIGHT;
    if (max <= min) return 18;
    
    let ratio = (Math.log(count) - Math.log(min)) / (Math.log(max) - Math.log(min));
    return 12 + ratio * 20; // 12px to 32px
  }

  private getGroupOpacity(count: number, min: number, max: number): number {
    if (!this.displayModes.opacity) return 1.0;
    if (max <= min) return 0.7;
    
    let ratio = (Math.log(count) - Math.log(min)) / (Math.log(max) - Math.log(min));
    return 0.4 + ratio * 0.6; // 0.4 to 1.0
  }

  private updateGroupPath(g: any, commits: Commit[], height: number) {
    let path = g.select("path");
    path.attr("d", this.getCommitGroupPathD(commits[0], commits[commits.length - 1], height));
    path.style("--y-offset", `${-height / 2}px`);
  }

  private updateGroupText(g: any, commits: Commit[]) {
    let text = g.select("text.commit-count");
    if (this.displayModes.text) {
      if (text.empty()) {
        text = g.append("text").attr("class", "commit-count")
          .attr("y", 2.5).attr("text-anchor", "middle").attr("fill", "white")
          .style("font-size", "8.5px").style("font-weight", "normal").style("stroke", "none")
          .style("pointer-events", "none");
      }
      
      let actualWidth = this.xScaledTimeZoned(commits[commits.length - 1].commitDate) - this.xScaledTimeZoned(commits[0].commitDate);
      let center_x = actualWidth / 2;
      
      text.attr("x", center_x).text(commits.length);
    } else {
      text.remove();
    }
  }



  toggleDrag() {
    this.drag = !this.drag;
  }

  resetZoom(conserve?: boolean) {
    this.data_g
      .transition()
      .duration(750)
      .call(
        this.zoom.transform,
        (conserve ? this.current_zoom : undefined) ||
          d3.zoomIdentity.translate(0, 0).scale(1)
      );

    // this.svg.append("g").attr("class", "brush").call(this.brush);
  }

  toggleDisplayMode(mode: 'opacity' | 'height' | 'text') {
    this.displayModes[mode] = !this.displayModes[mode];
    localStorage.setItem('commitDisplayModes', JSON.stringify(this.displayModes));
    this.refreshElementState();
  }

  zoomToGroup(commits: Commit[], range: number) {
    if (!commits || commits.length < 2 || range <= 0) return;

    let time_domain = this.x_scale.domain();
    let minDate = time_domain[0].valueOf() as number;
    let maxDate = time_domain[1].valueOf() as number;
    let dt = maxDate - minDate;

    let target_k = ((Utils.COMMIT_FUSE_RANGE + 5) * dt) / (range * this.inner_width);
    target_k = Math.min(target_k, this.maxZoom);

    let centerTime = (commits[0].commitDate.getTime() + commits[commits.length - 1].commitDate.getTime()) / 2;
    let translate_x = this.inner_width / 2 - ((centerTime - minDate) / dt) * this.inner_width * target_k;

    let transform = d3.zoomIdentity.translate(translate_x, 0).scale(target_k);

    this.data_g
      .transition()
      .duration(750)
      .call(this.zoom.transform, transform);
  }

  searchSubmit() {
    this.loadGraphDataAndRefresh();
  }

  onFilterGroupsChange(groups: FilterGroup[]) {
    this.filterGroups = groups;
    this.loadGraphDataAndRefresh();
  }

  clearQuestionsFilter() {
    if (this.questionsChooser) {
      this.questionsChooser.clearAll();
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

  private saveData() {
    this.dataService.saveData();

    this.loadGraphMetadata(
      this.dataService.repositories,
      this.dataService.reviews,
      this.dataService.corrections,
      this.dataService.questions
    );
  }
}
