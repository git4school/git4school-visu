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
  repository_g: d3.Selection<any, any, any, any>;
  repositories_g: d3.Selection<any, Repository, any, any>[];
  axis_g: d3.Selection<SVGGElement, any, any, any>;
  static GROUP_HEIGHT = 6;
  static CIRCLE_RADIUS = 6;
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

  @HostListener("window:keyup", ["$event"])
  keyEvent(event: KeyboardEvent) {
    if (event.keyCode === 32) {
      this.resetZoom();
    }
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

  svg;

  margin = { top: 10, right: 30, bottom: 80, left: 180 };
  width = 1800 - this.margin.left - this.margin.right;
  height = 600 - this.margin.top - this.margin.bottom;
  chart_svg: d3.Selection<any, any, any, any>;
  clip: d3.Selection<any, any, any, any>;
  zoom: d3.ZoomBehavior<any, any>;

  x_scale: d3.ScaleTime<any, any, any>;
  x_scale_copy: d3.ScaleTime<any, any, any>; // Used by zooming
  x_axis: d3.Axis<Date | d3.NumberValue>;
  x_g: d3.Selection<SVGGElement, any, any, any>;
  y_scale: d3.ScaleLinear<any, any, any>;
  y_axis: d3.Axis<d3.NumberValue>;
  y_g: d3.Selection<SVGGElement, any, any, any>;
  maxZoom: number;

  data_g: d3.Selection<any, any, any, any>;
  commits_g: d3.Selection<any, any, any, any>;

  ngAfterViewInit(): void {
    this.svg = d3
      .select(".chart-container")
      .append("svg")
      .attr(
        "viewBox",
        `0 0 ${this.width + this.margin.left + this.margin.right} ${
          this.height + this.margin.top + this.margin.right
        }`
      );

    this.chart_svg = this.svg
      .append("g")
      .attr(
        "transform",
        "translate(" + this.margin.left + "," + this.margin.top + ")"
      );

    d3.select(".chart-container").on("click", (e) => {
      this.onChartClick(e);
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

  loadGraphData() {
    this.loadAnnotations();
    this.loadPoints();
    setTimeout(() => {
      // this.adaptScaleWithChart(this.myChart.chart);
    });
  }

  loadGraphDataAndRefresh() {
    this.loadGraphData();

    // this.refreshGraph()
    // this.adaptScaleWithChart(this.myChart.chart);
  }

  loadAnnotations() {
    if (this.dataService.sessions && this.showSessions) {
      this.loadSessions();
    }

    if (this.dataService.reviews && this.showReviews) {
      this.loadReviews();
    }

    if (this.dataService.corrections && this.showCorrections) {
      this.loadCorrections();
    }

    if (this.dataService.others && this.showOthers) {
      this.loadOthers();
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
      this.contextualMenu.openNew(x, y, date);
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

  sesssion_g;

  getRectForSession(g: d3.Selection<any, any, any, any>, session: Session) {
    const overview = this;
    g.append("rect")
      .attr("class", "session")
      .attr("clip-path", "url(#clip)")
      .attr("x", this.x_scale_copy(session.startDate))
      .attr("height", this.height)
      .attr("y", 0)
      .attr(
        "width",
        this.x_scale_copy(session.endDate) -
          this.x_scale_copy(session.startDate)
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

    this.sesssion_g = this.chart_svg.append("g");

    const overview = this;

    setTimeout(() => {
      this.sesssion_g
        .selectAll(".session")
        .data(loaded_sessions)
        .enter()
        .each(function (d: Session) {
          overview.getRectForSession(d3.select(this), d);
        });
    });
  }

  getLineForMilestone(
    g: d3.Selection<any, any, any, any>,
    date: Date,
    class_: string
  ) {
    const overview = this;
    return g
      .append("rect")
      .attr("clip-path", "url(#clip)")
      .attr("class", class_)
      .attr("x", this.x_scale_copy(date))
      .attr("width", 1)
      .attr("y", 0)
      .attr("transform", "translate(" + [-1, 0] + ")")
      .attr("height", this.height)
      .on("click", (e, d: Milestone) => {
        e.stopPropagation();
        const rawDate = this.x_scale.invert(e.pageX);
        overview.openEditMilestoneContextMenu(d, e.pageX, e.pageY, rawDate); //, rawDate)
      });
  }

  review_g;

  loadReviews() {
    let loaded_reviews = this.dataService.reviews.filter(
      (review) =>
        (!this.dataService.groupFilter ||
          !review.tpGroup ||
          review.tpGroup === this.dataService.groupFilter) &&
        (!this.searchFilter.length ||
          this.searchFilter.filter((question) =>
            review.questions?.includes(question)
          ).length)
    );

    this.review_g = this.chart_svg.append("g");

    const overview = this;

    setTimeout(() => {
      this.sesssion_g
        .selectAll(".review")
        .data(loaded_reviews)
        .enter()
        .each(function (d: Milestone) {
          overview.getLineForMilestone(
            d3.select(this),
            d.date,
            "milestone review"
          );
        });
    });

    //   label: {
    //     content: review.label || "Review " + (index + 1),
    //     enabled: true,
    //     position: "top",
    //   },
  }

  correction_g;

  loadCorrections() {
    let loaded_corrections = this.dataService.corrections.filter(
      (correction) =>
        (!this.dataService.groupFilter ||
          !correction.tpGroup ||
          correction.tpGroup === this.dataService.groupFilter) &&
        (!this.searchFilter.length ||
          this.searchFilter.filter((question) =>
            correction.questions?.includes(question)
          ).length)
    );

    this.correction_g = this.chart_svg.append("g");

    const overview = this;

    setTimeout(() => {
      this.correction_g
        .selectAll(".review")
        .data(loaded_corrections)
        .enter()
        .each(function (d: Milestone) {
          overview.getLineForMilestone(
            d3.select(this),
            d.date,
            "milestone correction"
          );
        });
    });
    //   label: {
    //     content: correction.label || "Correction " + (index + 1),
    //     enabled: true,
    //     position: "top",
    //   },
  }

  other_g;

  getCommitSimpleComponent(
    parent: d3.Selection<any, Repository, any, any>,
    commit: Commit
  ): d3.Selection<any, Commit[], any, any> {
    let g = parent.append("g").datum([commit]);

    g.classed("simple-commit", true);

    let x = this.x_scale_copy(commit.commitDate);

    let comp: d3.Selection<any, any, any, any> = g
      .append("a")
      .attr("href", (d) => d[0].url);

    if (commit.isCloture) {
      comp = comp.append("circle").attr("r", 3).attr("class", "commit-cloture");
    } else {
      comp = comp.append("rect").attr("class", "commit-normal");
    }

    comp.attr("fill", commit.color.color);
    g.attr("date", (commit.commitDate as Date).getTime());

    g.attr("transfrom", `translate(${x}, 0)`);

    return g;
  }

  shouldGroupCommit(commit_before: Commit, commit_after: Commit): boolean {
    return (
      this.x_scale_copy(commit_after.commitDate) -
        this.x_scale_copy(commit_before.commitDate) <
      3
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

  static formatDay = d3.utcFormat("%Y/%m/%d");
  static formatHour = d3.utcFormat("%H:%M");

  static multiFormat(spacing: number, date: Date) {
    if (spacing > 24 * 3600) return this.formatDay(date);
    else return this.formatHour(date);
  }

  refreshElementState() {
    const overview = this;

    overview.repositories_g.forEach((repo_g) => {
      repo_g.selectAll(".commit").each(function () {
        let g: d3.Selection<any, Commit[], any, any> = d3.select(this);
        let commits = g.datum();

        let min_x = overview.x_scale_copy(commits[0].commitDate);
        let max_x = overview.x_scale_copy(
          commits[commits.length - 1].commitDate
        );

        g.classed("hidden", min_x < 0 || max_x >= overview.width);
      });

      repo_g
        .selectAll(".commit:not(.hidden)")
        .attr(
          "transform",
          (commits: Commit[]) =>
            `translate(${overview.x_scale_copy(commits[0].commitDate)}, 0)`
        );

      repo_g
        .selectAll("path:not(.hidden)")
        .attr(
          "d",
          (commits: Commit[]) =>
            `M 0 0 h ${Math.max(
              overview.x_scale_copy(commits[commits.length - 1].commitDate) -
                overview.x_scale_copy(commits[0].commitDate),
              6
            )} a ${OverviewComponent.CIRCLE_RADIUS} ${
              OverviewComponent.CIRCLE_RADIUS
            } 0 0 1 0 ${OverviewComponent.GROUP_HEIGHT} H 0 z`
        );
    });

    overview.repositories_g.forEach(function (repo_g) {
      //  Split groups
      repo_g.selectAll(".commit-group:not(.hidden)").each(function () {
        let g = d3.select(this);
        let range = Number.parseInt(g.attr("group_range"));
        let date = Number.parseInt(g.attr("after_date"));

        let range_in_pixel =
          overview.x_scale_copy(range + date) - overview.x_scale_copy(date);

        if (range_in_pixel > 3) {
          let before = undefined;
          let commits = g.datum() as Commit[];
          g.remove();
          commits.forEach((commit) => {
            before = overview.getCommitComponent(repo_g, commit, before);
          });
        }
      });

      let before = undefined;
      let toCommit = [];
      let toRemove = [];
      //  Regroup commits
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
            before = overview.getCommitGroupComponentFromScratch(
              repo_g,
              commits
            );
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
    });

    overview.repositories_g.forEach((g, i) => {
      g.selectAll(".commit_line")
        .attr("x1", function () {
          let real_x = overview.x_scale_copy(
            new Date(Number.parseInt(d3.select(this).attr("min_date")))
          );
          return Math.max(Math.min(real_x, overview.width), 0);
        })
        .attr("x2", function () {
          let real_x = overview.x_scale_copy(
            new Date(Number.parseInt(d3.select(this).attr("max_date")))
          );
          return Math.max(Math.min(real_x, overview.width), 0);
        });
    });

    this.sesssion_g
      .selectAll(".session")
      .attr("x", (s: Session) => overview.x_scale_copy(s.startDate))
      .attr(
        "width",
        (s: Session) =>
          overview.x_scale_copy(s.endDate) - overview.x_scale_copy(s.startDate)
      );

    this.review_g
      .selectAll(".correction")
      .attr("x", (m: Milestone) => overview.x_scale_copy(m.date));
    this.correction_g
      .selectAll(".correction")
      .attr("x", (m: Milestone) => overview.x_scale_copy(m.date));
    this.other_g
      .selectAll(".correction")
      .attr("x", (m: Milestone) => overview.x_scale_copy(m.date));
  }

  commits_line_g;

  loadPoints() {
    const overview = this;
    const repositories: Repository[] = this.dataService.repositories.filter(
      (repository) =>
        !this.dataService.groupFilter ||
        repository.tpGroup === this.dataService.groupFilter
    );

    this.repository_g = this.chart_svg.append("g");
    this.repositories_g = new Array<any>(repositories.length);
    {
      let [minDate, maxDate] = d3.extent(
        repositories.map((v) => v.commits).reduce((a, b) => a.concat(b), []),
        (d) => d.commitDate
      );
      this.setupAxis(repositories, minDate, maxDate);

      this.maxZoom = (maxDate.getTime() - minDate.getTime()) / (1000 * 60);
    }

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
        let commits = repository.commits.sort(
          (a, b) => a.commitDate.getTime() - b.commitDate.getTime()
        );

        let minDateTime: number, maxDateTime: number;

        commits.forEach((commit) => {
          minDateTime =
            minDateTime == null
              ? commit.commitDate.getTime()
              : Math.min(commit.commitDate.getTime(), minDateTime);
          maxDateTime =
            minDateTime == null
              ? commit.commitDate.getTime()
              : Math.max(commit.commitDate.getTime(), minDateTime);
          before = overview.getCommitComponent(d3.select(this), commit, before);
        });

        overview.repositories_g[i]
          .insert("line", ":first-child")
          .attr("class", "commit_line")
          .attr("min_date", minDateTime)
          .attr("max_date", maxDateTime)
          .attr("x1", overview.x_scale_copy(minDateTime))
          .attr("x2", overview.x_scale_copy(maxDateTime));
      });

    overview.zoom = d3
      .zoom()
      .on("zoom", (event) => {
        overview.x_scale_copy = event.transform.rescaleX(overview.x_scale);
        overview.x_g.call(this.x_axis.scale(overview.x_scale_copy));
        overview.refreshElementState();
      })
      .scaleExtent([0.5, overview.maxZoom]);

    this.resetZoom();
  }

  onChartClick(event) {
    const rawDate = this.x_scale.invert(event.pageX);
    this.openContextMenu(event.pageX, event.pageY, rawDate);
  }

  resetZoom() {
    d3.select(".chart-container")
      .call(this.zoom)
      .call(this.zoom.transform, d3.zoomIdentity.translate(0, 0).scale(1));
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
