import {
  AfterViewInit,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewEncapsulation,
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
import { Subscription, concat } from "rxjs";
import { BaseGraphComponent } from "../base-graph.component";

import * as d3 from "d3";
import { Repository } from "../../../models/Repository.model";
import { tick } from "@angular/core/testing";
import { rejects } from "assert";
import { Utils } from "../../../services/utils";

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
  @ViewChild(OverviewGraphContextualMenuComponent) contextualMenu;

  minZoom: number;

  contextualMenuShown: boolean;

  assignmentsModified$: Subscription;

  typeaheadSettings;
  searchFilter: string[] = [];
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
  margin = { top: 0, right: 30, bottom: 80, left: 250 };
  margin_abs = { top: 30, right: 30, bottom: 80, left: 250 };
  width = 1800 - this.margin.left - this.margin.right;
  height = 200 - this.margin.top - this.margin.bottom;
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

  static GROUP_HEIGHT = 12;
  static CIRCLE_RADIUS = 12;
  brush: d3.BrushBehavior<any>;
  current_zoom: any;
  chart_abs_g: d3.Selection<SVGGElement, any, any, any>;
  svg_abs: d3.Selection<any, unknown, HTMLElement, any>;
  real_height: number;
  ////////////////////////

  constructor(
    private translateService: TranslateService,
    private toastService: ToastService,
    public jsonManager: JsonManagerService,
    public dataService: DataService,
    protected loaderService: LoaderService,
    private modalService: NgbModal,
    protected assignmentsService: AssignmentsService
  ) {
    super(loaderService, assignmentsService, dataService);
  }

  ngOnInit(): void {
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

  ngOnDestroy(): void {
    this.unsubscribeAssignmentModified(this.assignmentsModified$);
  }

  commit_date_format = Utils.COMMIT_DATE_FORMAT;

  ngAfterViewInit(): void {
    this.height += this.dataService.repositories.length * 35;
    this.real_height = Math.min(570, this.height);

    this.svg = d3
      .select(".chart-container")
      .append("svg")
      .attr(
        "viewBox",
        `0 0 ${this.width + this.margin.left + this.margin.right} ${
          this.height + this.margin.top + this.margin.right
        }`
      );

    this.svg_abs = d3
      .select(".chart-container-absolute")
      .append("svg")
      .attr(
        "viewBox",
        `0 0 ${this.width + this.margin_abs.left + this.margin_abs.right} ${
          Math.min(600, this.height) + 2 * 30 /*padding*/
        } `
      );

    const overview = this;

    this.chart_svg = this.svg
      .append("g")
      .attr(
        "transform",
        "translate(" + this.margin.left + "," + this.margin.top + ")"
      );

    this.data_g = this.chart_svg.append("g");

    this.chart_abs_g = this.svg_abs
      .append("g")
      .attr(
        "transform",
        "translate(" + this.margin_abs.left + "," + this.margin_abs.top + ")"
      );

    this.data_g
      .append("rect")
      .attr("id", "data")
      .attr("width", this.width)
      .attr("height", this.height)
      .attr("opacity", "0")
      .on("click", (event: MouseEvent) => {
        event.stopPropagation();
        var rect = (event.target as any).getBoundingClientRect();
        var x =
          ((event.clientX - rect.left) / (rect.right - rect.left)) *
          overview.width; //x position within the element.
        let rawDate = overview.x_scale_copy.invert(x);
        this.openContextMenu(x, event.pageY, rawDate);
      });

    d3.select(".chart-container")
      .on("mousemove", function (e) {
        overview.refreshTooltip(e.clientX, e.clientY);
      })
      .on("scroll", (e) => {
        overview.refreshTooltip(e.clientX, e.clientY);
        overview.refreshElementState();
      })
      .attr("tabindex", "0")
      .attr("focusable", "true")
      .on("keypress", (event) => {
        if (event.keyCode === 32) {
          this.resetZoom(false);
        }
      });

    this.clip = this.chart_svg
      .append("defs")
      .append("svg:clipPath")
      .attr("id", "clip")
      .append("svg:rect")
      .attr("width", this.width)
      .attr("height", 2 * this.height)
      .attr("fill", "black")
      .attr("x", 0)
      .attr("y", -this.height);

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
    var tooltip = document.getElementById("tooltip");
    if (tooltip == null) {
      return;
    }

    tooltip.style.top = y + 20 + "px";
    tooltip.style.left = x + 20 + "px";

    if (this.hovered_g) {
      if (this.hovered_g.select(":hover").empty()) {
        this.hovered_commit = undefined;
        this.hovered_group_commit = undefined;
        this.hovered_g = null;
      }
    }
  }

  loadGraphData() {
    this.loadAnnotations();
    this.loadPoints();
    this.setupZoom();
  }

  setupZoom() {
    const overview = this;
    this.zoom = d3
      .zoom()
      .on("zoom", (event) => {
        if (overview.drag) {
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

  loadGraphDataAndRefresh() {
    this.margin = { top: 0, right: 30, bottom: 80, left: 250 };
    this.margin_abs = { top: 30, right: 30, bottom: 80, left: 250 };
    this.width = 1800 - this.margin.left - this.margin.right;
    this.height = 200 - this.margin.top - this.margin.bottom;

    const repositories: Repository[] = this.dataService.repositories.filter(
      (repository) =>
        !this.dataService.groupFilter ||
        repository.tpGroup === this.dataService.groupFilter
    );

    this.height += repositories.length * 35;
    this.real_height = Math.min(570, this.height);

    this.svg.remove();

    this.svg = d3
      .select(".chart-container")
      .append("svg")
      .attr(
        "viewBox",
        `0 0 ${this.width + this.margin.left + this.margin.right} ${
          this.height + this.margin.top + this.margin.right
        }`
      );

    this.svg_abs.remove();
    this.svg_abs = d3
      .select(".chart-container-absolute")
      .append("svg")
      .attr(
        "viewBox",
        `0 0 ${this.width + this.margin_abs.left + this.margin_abs.right} ${
          Math.min(600, this.height) + 2 * 30 /*padding*/
        } `
      );

    const overview = this;

    this.chart_svg = this.svg
      .append("g")
      .attr(
        "transform",
        "translate(" + this.margin.left + "," + this.margin.top + ")"
      );

    this.data_g = this.chart_svg.append("g");

    this.chart_abs_g = this.svg_abs
      .append("g")
      .attr(
        "transform",
        "translate(" + this.margin_abs.left + "," + this.margin_abs.top + ")"
      );

    this.data_g
      .append("rect")
      .attr("id", "data")
      .attr("width", this.width)
      .attr("height", this.height)
      .attr("opacity", "0")
      .on("click", (event: MouseEvent) => {
        event.stopPropagation();
        var rect = (event.target as any).getBoundingClientRect();
        var x =
          ((event.clientX - rect.left) / (rect.right - rect.left)) *
          overview.width; //x position within the element.
        let rawDate = overview.x_scale_copy.invert(x);
        this.openContextMenu(x, event.pageY, rawDate);
      });

    d3.select(".chart-container")
      .on("mousemove", function (e) {
        overview.refreshTooltip(e.clientX, e.clientY);
      })
      .on("scroll", () => this.refreshElementState())
      .attr("tabindex", "0")
      .attr("focusable", "true")
      .on("keypress", (event) => {
        if (event.keyCode === 32) {
          this.resetZoom(false);
        }
      });

    this.clip = this.chart_svg
      .append("defs")
      .append("svg:clipPath")
      .attr("id", "clip")
      .append("svg:rect")
      .attr("width", this.width)
      .attr("height", 2 * this.height)
      .attr("fill", "black")
      .attr("x", 0)
      .attr("y", -this.height);

    this.loadGraphData();
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

    if (this.session_g != null) this.session_g.remove();
    if (this.review_g != null) this.session_g.remove();
    if (this.correction_g != null) this.session_g.remove();
    if (this.other_g != null) this.session_g.remove();
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
    this.contextualMenu.openEditMilestone(review, x, y, date);
  }

  openEditSessionContextMenu(
    session: Session,
    x: number,
    y: number,
    date: Date
  ) {
    this.contextualMenu.close();
    this.contextualMenu.openEditSession(session, x, y, date);
  }

  openContextMenu(x: number, y: number, date: Date) {
    if (!this.isContextualMenuShown()) {
      try {
        this.contextualMenu.openNew(x, y, date);
      } catch (error) {}
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
      .attr("x", this.xScaledTimeZoned(session.startDate))
      .attr("height", this.height)
      .attr("y", 0)
      .attr(
        "width",
        this.xScaledTimeZoned(session.endDate) -
          this.xScaledTimeZoned(session.startDate)
      )
      .on("click", (e) =>
        overview.openEditSessionContextMenu(
          session,
          e.pageX,
          e.pageY,
          overview.x_scale.invert(e.pageX)
        )
      );
  }

  loadSessions() {
    let loaded_sessions: Session[] = this.dataService.sessions.filter(
      (session) =>
        !this.dataService.groupFilter ||
        !session.tpGroup ||
        session.tpGroup === this.dataService.groupFilter
    );

    this.session_g = this.chart_abs_g.append("g");

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

  getLineForMilestone(
    parent: d3.Selection<any, any, any, any>,
    m: Milestone,
    class_: string,
    index: number
  ) {
    const overview = this;
    let g = parent.append("g").attr("class", class_);

    // Line
    g.append("rect")
      // .attr("clip-path", "url(#clip)")
      .attr("x", 0)
      .attr("width", 1)
      .attr("y", 0)
      .attr("transform", "translate(" + [-1, 0] + ")")
      .attr("height", 100000);

    // Box
    let box = g.append("rect").attr("y", 20);

    // Text
    let text = g
      .append("text")
      .attr("y", -8)
      .text(m.label || m.type.substring(0, m.type.length - 1) + " " + index)
      .attr("text-anchor", "middle");

    let bbox = text.node().getBBox();

    bbox.width += 4;
    bbox.height += 5;
    bbox.x -= 2;
    bbox.y -= 1;

    box.attr("width", bbox.width);
    box.attr("height", bbox.height);
    box.attr("x", -bbox.width / 2);
    box.attr("y", bbox.y);

    let x = this.xScaledTimeZoned(m.date);

    return g
      .attr("transform", `translate(${x}, 0)`)
      .call((g) => g.classed("hidden", x < 0 || x > overview.width))
      .on("click", (e, d: Milestone) => {
        e.stopPropagation();
        const rawDate = this.x_scale.invert(e.pageX);
        overview.openEditMilestoneContextMenu(d, e.pageX, e.pageY, rawDate); //, rawDate)
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
      .range([0, this.width])
      .nice();

    this.x_scale_copy = this.x_scale.copy();

    this.x_axis = d3
      .axisBottom(this.x_scale_copy)
      .ticks(6)
      .tickSize(-this.real_height);

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
      .attr("transform", "translate(" + [0, this.real_height] + ")")
      .call(this.x_axis);

    this.y_scale = d3
      .scaleLinear()
      .domain([0, repositories.length + 1])
      .range([0, this.height]);

    this.y_axis = d3
      .axisLeft(this.y_scale)
      .tickValues([...Array(repositories.length + 1).keys()])
      .tickFormat((d) => repositories[d.valueOf() - 1]?.name || "")
      .tickSize(-this.width);

    if (this.y_g != null) this.y_g.remove();
    this.y_g = this.axis_g.append("g").call(this.y_axis);

    // Hide the first tick use to prevent data from being placed on top of the chart
    this.y_g.select(".tick:first-of-type").attr("opacity", "0");

    // Set repo_name class
    this.y_g
      .selectAll(".tick")
      .selectAll("text")
      .call((g) => g.classed("repo_name", true));

    // Use custom domain
    this.axis_abs_g.selectAll(".domain").style("opacity", "0");

    this.axis_g
      .append("g")
      .attr("class", "axis")
      .append("line")
      .attr("x1", 0)
      .attr("x2", 0)
      .attr("y1", 0)
      .attr("y2", this.height);

    this.axis_g
      .append("g")
      .attr("class", "axis")
      .append("line")
      .attr("x1", 0)
      .attr("x2", this.width)
      .attr("y1", this.height)
      .attr("y2", this.height);
  }

  getCommitGroupPathD(first: Commit, last: Commit) {
    let begin_x = this.xScaledTimeZoned(first.commitDate);
    let end_x = this.xScaledTimeZoned(last.commitDate);

    if (last.isCloture) {
      return `M 0 0 h ${Math.max(
        end_x - begin_x,
        1.5 * OverviewComponent.CIRCLE_RADIUS
      )} a ${OverviewComponent.CIRCLE_RADIUS} ${
        OverviewComponent.CIRCLE_RADIUS
      } 0 0 1 0 ${OverviewComponent.GROUP_HEIGHT} H 0 z`;
    } else {
      return `M 0 0 h ${Math.max(
        end_x - begin_x,
        1.5 * OverviewComponent.CIRCLE_RADIUS
      )} v ${OverviewComponent.CIRCLE_RADIUS} H 0 z`;
    }
  }

  getCommitGroupComponentFromScratch(
    parent: d3.Selection<any, Repository, any, any>,
    commits: Commit[]
  ): d3.Selection<any, Commit[], any, any> {
    let sorted = commits.sort(
      (a, b) => a.commitDate.getTime() - b.commitDate.getTime()
    );

    let g = parent.append("g").datum(sorted);

    let begin_x = this.xScaledTimeZoned(sorted[0].commitDate);
    let end_x = this.xScaledTimeZoned(sorted[sorted.length - 1].commitDate);

    g.attr("class", "commit-group commit")
      .append("path")
      .attr("d", this.getCommitGroupPathD(sorted[0], sorted[sorted.length - 1]))
      .attr("transform", `translate(0, ${-OverviewComponent.GROUP_HEIGHT / 2})`)
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

      g = parent.append("g").datum([commit]);

      g.attr("class", "commit-group")
        .append("path")
        .attr("d", this.getCommitGroupPathD(commit, commit))
        .attr(
          "transform",
          `translate(0, ${-OverviewComponent.GROUP_HEIGHT / 2})`
        )
        .attr("fill", commit.color.color)
        .attr("class", "data")
        .on("mouseenter", (e, d) => (this.hovered_group_commit = d))
        .on("mouseleave", () => {
          this.hovered_group_commit = undefined;
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
            all_commits[all_commits.length - 1]
          )
        )
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

  static formatDay = d3.utcFormat("%d/%m/%Y");
  static formatHour = d3.utcFormat("%H:%M");

  static multiFormat(spacing: number, date: Date) {
    const options: Intl.NumberFormatOptions = {
      useGrouping: false,
      minimumIntegerDigits: 2,
    };

    if (spacing > 24 * 3600)
      return `${date.getDate().toLocaleString(undefined, options)}/${date
        .getMonth()
        .toLocaleString(undefined, options)}/${date
        .getFullYear()
        .toLocaleString(undefined, options)}`;
    else
      return `${date.getHours().toLocaleString(undefined, options)}:${date
        .getMinutes()
        .toLocaleString(undefined, options)}`;
  }

  loadPoints() {
    const overview = this;
    const repositories: Repository[] = this.dataService.repositories.filter(
      (repository) =>
        !this.dataService.groupFilter ||
        repository.tpGroup === this.dataService.groupFilter
    );

    if (this.repository_g != null) this.repository_g.remove();

    this.repository_g = this.data_g.append("g");
    this.repositories_g = new Array<any>(repositories.length);
    let [minDate, maxDate] = d3.extent(
      repositories.map((v) => v.commits).reduce((a, b) => a.concat(b), []),
      (d) => d.commitDate
    );
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
          .filter(
            (commit) =>
              !overview.searchFilter.length ||
              overview.searchFilter.includes(commit.question)
          )
          .sort((a, b) => a.commitDate.getTime() - b.commitDate.getTime());

        let minDateTime: number, maxDateTime: number;

        let lines = [];
        let current_line: Commit | undefined = undefined;

        commits.forEach((commit) => {
          minDateTime =
            minDateTime == null
              ? commit.commitDate.getTime()
              : Math.min(commit.commitDate.getTime(), minDateTime);
          maxDateTime =
            minDateTime == null
              ? commit.commitDate.getTime()
              : Math.max(commit.commitDate.getTime(), minDateTime);
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
            .attr("max_date", d2.getTime())
            .attr("x1", overview.xScaledTimeZoned(d1))
            .attr("x2", overview.xScaledTimeZoned(d2));
        });
      });
  }

  refreshRepoBySplittingGroup(repo_g) {
    const overview = this;
    repo_g.selectAll(".commit-group:not(.hidden)").each(function () {
      let g = d3.select(this);
      let range = Number.parseInt(g.attr("group_range"));
      let date = Number.parseInt(g.attr("after_date"));

      let range_in_pixel =
        overview.xScaledTimeZoned(new Date(range + date)) -
        overview.xScaledTimeZoned(new Date(date));

      if (range_in_pixel >= Utils.COMMIT_FUSE_RANGE) {
        if (overview.hovered_g === g) {
          overview.hovered_g = undefined;
          overview.hovered_group_commit = undefined;
        }
        let before = undefined;
        let commits = g.datum() as Commit[];
        g.remove();
        commits.forEach((commit) => {
          before = overview.getCommitComponent(repo_g, commit, before);
        });
      }
    });
  }

  refreshRepoByGrouping(repo_g) {
    const overview = this;
    let before = undefined;
    let toCommit = [];
    let toRemove = [];

    repo_g
      .selectAll(".commit:not(.hidden)")
      .sort(
        (a: Commit[], b: Commit[]) =>
          a[0].commitDate.getTime() - b[0].commitDate.getTime()
      )
      .each(function (commit: Commit[]) {
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
      })
      .sort(
        (a: Commit[], b: Commit[]) =>
          a[0].commitDate.getTime() - b[0].commitDate.getTime()
      );

    toRemove.forEach((g) => g.remove());
    toCommit.forEach((g) => g.classed("commit", true));
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
    if (!d) {
      return Number.MIN_VALUE;
    }

    return this.x_scale_copy(d) + this.getOffset(d);
  }

  refreshElementState() {
    const containerRect = (d3.select(".chart-container") as any)
      .node()
      .getBoundingClientRect();
    const overview = this;

    if (overview.repository_g)
      overview.repositories_g.forEach((repo_g, i: number) => {
        repo_g.selectAll(".commit").each(function () {
          let g: d3.Selection<any, Commit[], any, any> = d3.select(this);

          let node = repo_g.node();
          let nodeRect = (node as any).getBoundingClientRect();

          const nodeVisible =
            nodeRect.right >= containerRect.left &&
            nodeRect.left <= containerRect.right &&
            nodeRect.bottom >= containerRect.top &&
            nodeRect.top <= containerRect.bottom;

          g.classed("hidden", !nodeVisible);
        });

        repo_g
          .selectAll(".commit:not(.hidden)")
          .attr(
            "transform",
            (commits: Commit[]) =>
              `translate(${overview.xScaledTimeZoned(
                commits[0].commitDate
              )}, 0)`
          );

        repo_g
          .selectAll("path:not(.hidden)")
          .attr("d", (commits: Commit[]) =>
            this.getCommitGroupPathD(commits[0], commits[commits.length - 1])
          );
      });

    this.chart_abs_g.selectAll(".milestone").each(function (m: Milestone) {
      let g = d3.select(this);
      let x = overview.xScaledTimeZoned(m.date);
      g.classed("hidden", x < 0 || x > overview.width);
    });

    overview.repositories_g.forEach((repo_g) =>
      this.refreshRepoBySplittingGroup(repo_g)
    );
    overview.repositories_g.forEach((repo_g) =>
      this.refreshRepoByGrouping(repo_g)
    );

    overview.repositories_g.forEach((g, i) => {
      g.selectAll(".commit_line")
        .attr("x1", function () {
          let real_x = overview.xScaledTimeZoned(
            new Date(Number.parseInt(d3.select(this).attr("min_date")))
          );
          return Math.max(Math.min(real_x, overview.width), 0);
        })
        .attr("x2", function () {
          let real_x = overview.xScaledTimeZoned(
            new Date(Number.parseInt(d3.select(this).attr("max_date")))
          );
          return Math.max(Math.min(real_x, overview.width), 0);
        });
    });

    this.session_g
      .selectAll(".session")
      .attr("x", (s: Session) => {
        return overview.xScaledTimeZoned(s.startDate);
      })
      .attr(
        "width",
        (s: Session) =>
          overview.xScaledTimeZoned(s.endDate) -
          overview.xScaledTimeZoned(s.startDate)
      );

    this.chart_abs_g
      .selectAll(".milestone")
      .attr(
        "transform",
        (m: Milestone) => `translate(${overview.xScaledTimeZoned(m.date)}, 0)`
      );
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

  searchSubmit() {
    this.loadGraphDataAndRefresh();
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
