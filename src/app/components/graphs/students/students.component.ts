import { Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, TemplateRef, ViewChild, ViewEncapsulation } from "@angular/core";
import { CommitColor } from "@models/Commit.model";
import { TranslateService } from "@ngx-translate/core";
import { AssignmentsService } from "@services/assignments.service";
import { CommitsService } from "@services/commits.service";
import { DataService } from "@services/data.service";
import { LoaderService } from "@services/loader.service";
import { TooltipService } from "@services/tooltip.service";
import { ThemeService } from "@services/theme.service";
import { AnonymizationService } from "@services/anonymization.service";
import { Subscription } from "rxjs";

import { BaseGraphComponent } from "../base-graph.component";
import { StackedBarChart, StackedBarScaffold } from "../shared/stacked-bar-chart";
import { Repository } from "@models/Repository.model";
import { Utils } from "../../../services/utils";
import { OsUtils } from "@utils/os.utils";
import * as d3 from "d3";

@Component({
  selector: "students",
  templateUrl: "./students.component.html",
  styleUrls: ["./students.component.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class StudentsComponent extends BaseGraphComponent implements OnInit, OnDestroy {
  @ViewChild("chartContainer", { static: true }) chartContainer: ElementRef;
  @ViewChild("leftAxisContainer", { static: true }) leftAxisContainer: ElementRef;
  @ViewChild("rightAxisContainer", { static: true }) rightAxisContainer: ElementRef;
  @ViewChild("d3TooltipTemplate") d3TooltipTemplate!: TemplateRef<any>;
  @ViewChild("repoTooltipTemplate") repoTooltipTemplate!: TemplateRef<any>;

  readonly slider_step = Utils.SLIDER_STEP;
  assignmentsModified$: Subscription;
  groupFilterSub: Subscription;

  date: number;
  min: number;
  max: number;
  chartData: any[] = [];
  chartMargin: any;

  commitColors = [CommitColor.INTERMEDIATE, CommitColor.BEFORE, CommitColor.BETWEEN, CommitColor.AFTER];
  hiddenCategories = new Set<string>();
  showProgressionLine = true;
  pressedShortcut: string = null;
  hovered_repository: { name: string; url: string } | null = null;

  private svg: any;

  constructor(
    public dataService: DataService,
    private commitsService: CommitsService,
    public translateService: TranslateService,
    protected loaderService: LoaderService,
    protected assignmentsService: AssignmentsService,
    private tooltipService: TooltipService,
    public themeService: ThemeService,
    public anonymizationService: AnonymizationService,
    private ngZone: NgZone,
  ) {
    super(loaderService, assignmentsService, dataService, translateService, anonymizationService);
  }

  @HostListener("document:keydown", ["$event"])
  handleGlobalShortcuts(event: KeyboardEvent) {
    if (OsUtils.isTypingInInput(event)) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === "r") {
      event.preventDefault();
      this.loadGraph(this.dataService.startDate, this.dataService.endDate);
      this.triggerShortcut("r");
    }
  }

  ngOnInit() {
    setTimeout(() =>
      this.startGraphView({
        refresh: () => this.loadGraphDataAndRefresh(),
        draw: () => this.drawGraph(),
        hasData: () => this.chartData && this.chartData.length > 0,
        observe: () => this.chartContainer,
        seed: () => {
          this.initDateSlider();
          this.loadGraphMetadata(
            this.dataService.repositories,
            this.dataService.reviews,
            this.dataService.corrections,
            this.dataService.questions,
          );
        },
      }),
    );
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
  }

  loadGraphDataAndRefresh(_conserveZoom?: boolean) {
    let translations = this.translateService.instant(["STUDENT", "COMMITS-COUNT", "COMMITS-PERCENTAGE"]);
    let colors = [CommitColor.INTERMEDIATE, CommitColor.BEFORE, CommitColor.BETWEEN, CommitColor.AFTER];

    let dict = this.commitsService.loadStudentsDict(
      this.dataService.repositories,
      this.dataService.questions,
      colors,
      this.dataService.groupFilter,
      this.date,
    );

    // Get an array of repositories (students) filtered
    const labels = this.dataService.repositories
      .filter((repository) => !this.dataService.groupFilter || repository.tpGroup === this.dataService.groupFilter)
      .map((repository) => repository.name);

    // Convert dict back to an ordered array according to labels
    this.chartData = labels.map((label) => {
      let studentData = dict[label];
      let repo = this.dataService.repositories?.find((r) => r.name === label);
      let displayName = repo ? this.anonymizationService.getDisplayName(repo) : label;
      let result: any = {
        student: displayName,
        rawName: label,
        commitsCount: studentData.commitsCount,
        lastQuestionDone: studentData.lastQuestionDone,
        url: studentData.url,
        tpGroup: studentData.tpGroup,
        translations: translations,
      };
      colors.forEach((color) => {
        result[color.label] = studentData.commitTypes[color.label].percentage || 0;
        result[color.label + "_data"] = studentData.commitTypes[color.label];
      });
      return result;
    });

    this.drawGraph();
  }

  updateBar() {
    this.drawGraph();
  }

  onScroll(_event: Event) {
    // Left empty since CSS positioning takes over, but retained if needed
  }

  drawGraph() {
    const element = this.chartContainer.nativeElement;
    const leftElement = this.leftAxisContainer.nativeElement;
    const rightElement = this.rightAxisContainer.nativeElement;

    if (!StackedBarChart.prepare([element, leftElement, rightElement], this.chartData ? this.chartData.length : 0)) {
      return;
    }

    const colors = [CommitColor.INTERMEDIATE, CommitColor.BEFORE, CommitColor.BETWEEN, CommitColor.AFTER];
    const scaffold = StackedBarChart.createScaffold(
      element,
      this.chartData.map((d) => d.student),
      {
        margin: { top: 40, right: 80, bottom: 100, left: 60 },
        minBarWidth: 60,
        axisFontSize: 11,
      },
    );

    if (!scaffold) {
      return;
    }

    this.chartMargin = scaffold.margin;
    this.svg = scaffold.svg;

    const questionsList = this.dataService.questions ? this.dataService.questions.slice() : [];
    const yRight = d3
      .scalePoint()
      .domain(questionsList)
      .range([scaffold.height - 15, 15])
      .padding(0);

    // X axis: one band per student, labelled with the (possibly anonymised, truncated) name.
    // A click opens the repository, a hover shows the repository tooltip.
    StackedBarChart.renderBottomAxis(scaffold, { fontSize: 11 })
      .call((g) => g.classed("repo_name", true))
      .each(function (this: SVGTextElement) {
        const textStr = this.textContent || "";
        this.textContent = Utils.truncateMiddle(textStr, Utils.OVERVIEW_NAME_LENGTH_LIMIT);
      })
      .on("click", (event: MouseEvent, d: any) => {
        event.stopPropagation();
        if (this.anonymizationService.isAnonymous) {
          return;
        }
        const matchedItem = this.chartData.find((cd) => cd.student === d);
        const repo = this.findRepositoryForBand(d, matchedItem);
        if (repo?.url) {
          window.open(repo.url, "_blank");
        }
      })
      .on("mouseenter", (event: MouseEvent, d: any) => {
        event.stopPropagation();
        const matchedItem = this.chartData.find((cd) => cd.student === d);
        const repo = this.findRepositoryForBand(d, matchedItem);
        if (repo || matchedItem) {
          this.ngZone.run(() => {
            this.hovered_repository = {
              name: d,
              url: this.anonymizationService.isAnonymous ? null : repo?.url || matchedItem?.url,
            };
            this.tooltipService.showAtPosition(this.repoTooltipTemplate, event.clientX, event.clientY, "right", undefined, true);
          });
        }
      })
      .on("mousemove", (event: MouseEvent) => {
        event.stopPropagation();
        if (this.tooltipService.isShowing()) {
          this.tooltipService.moveTooltip(event.clientX, event.clientY, "right");
        }
      })
      .on("mouseleave", (event: MouseEvent) => {
        event.stopPropagation();
        this.ngZone.run(() => {
          this.hovered_repository = undefined;
          this.tooltipService.hide();
        });
      });

    StackedBarChart.renderLeftPercentAxis(leftElement, scaffold, this.translateService.instant("PERCENT-COMMITS"), 11);
    StackedBarChart.renderRightAxis(rightElement, scaffold, yRight, this.translateService.instant("QUESTIONS"), 11);
    StackedBarChart.renderGrid(scaffold);

    const stackedData = d3.stack().keys(colors.map((c) => c.label).filter((k) => !this.hiddenCategories.has(k)))(this.chartData);

    // Hover background rects
    this.svg
      .append("g")
      .selectAll("rect.hover-bg")
      .data(this.chartData)
      .enter()
      .append("rect")
      .attr("class", "hover-bg")
      .attr("x", (d) => scaffold.x(d.student) - scaffold.x.bandwidth() * 0.1)
      .attr("y", 0)
      .attr("width", scaffold.x.bandwidth() * 1.2)
      .attr("height", scaffold.height)
      .style("fill", "transparent")
      .on("mouseover", (event, d) => {
        this.showTooltip(event, d, colors);
        this.svg
          .selectAll("rect.bar")
          .filter((rectD: any) => rectD.data.student === d.student)
          .style("opacity", 0.8);
      })
      .on("mousemove", (event) => {
        if (this.tooltipService.isShowing()) {
          this.tooltipService.moveTooltip(event.clientX, event.clientY, "right");
        }
      })
      .on("mouseout", (event, d) => {
        this.tooltipService.hide();
        this.svg
          .selectAll("rect.bar")
          .filter((rectD: any) => rectD.data.student === d.student)
          .style("opacity", 1);
      });

    // Draw Stacked Bars
    const visibleColors = colors.filter((c) => !this.hiddenCategories.has(c.label));

    StackedBarChart.renderLayers(scaffold, stackedData, visibleColors, (d) => d.data.student, {
      className: "bar",
      pointerEventsNone: true,
    });

    this.renderCommitCountBadges(scaffold);
    this.renderProgressionLine(scaffold, yRight);
  }

  showTooltip(event: MouseEvent, data: any, colors: any[]) {
    const stats = colors
      .map((c) => {
        return {
          label: c.label,
          labelKey: c.labelKey,
          color: c.color,
          percentage: data[c.label],
          count: data[c.label + "_data"]?.commitsCount || 0,
        };
      })
      .filter((s) => s.count > 0);

    const tooltipData = {
      student: data.student,
      commitsCount: data.commitsCount,
      lastQuestionDone: data.lastQuestionDone,
      stats: stats,
    };

    this.tooltipService.showAtPosition(this.d3TooltipTemplate, event.clientX, event.clientY, "right", undefined, true, { tooltipData });
  }

  loadGraph(startDate?: string, endDate?: string) {
    this.loading = true;
    this.loaderService.loadRepositories(startDate, endDate).subscribe(() => {
      this.initDateSlider();
      this.loadGraphMetadata(
        this.dataService.repositories,
        this.dataService.reviews,
        this.dataService.corrections,
        this.dataService.questions,
      );
      this.loading = false;
    });
  }

  initDateSlider() {
    if (this.dataService.lastUpdateDate) {
      this.date = this.dataService.lastUpdateDate.getTime();

      if (this.date) {
        let interval = Utils.getTimeInterval(
          this.dataService.repositories
            .map((v) => v.commits)
            .filter(Boolean)
            .reduce((a, b) => a.concat(b), []),
          (v) => v.commitDate,
        );

        this.min = interval[0].getTime();
        this.max = interval[1].getTime();
      }
    }
  }

  getAdjustedMaxTimestamp() {
    return Math.ceil((this.max - this.min) / this.slider_step) * this.slider_step + this.min;
  }

  toggleCategory(label: string) {
    if (this.hiddenCategories.has(label)) {
      this.hiddenCategories.delete(label);
    } else {
      // Don't hide if it's the last one
      if (this.hiddenCategories.size === this.commitColors.length - 1) return;
      this.hiddenCategories.add(label);
    }
    this.drawGraph();
  }

  toggleProgressionLine() {
    this.showProgressionLine = !this.showProgressionLine;
    this.drawGraph();
  }

  private triggerShortcut(key: string) {
    this.pressedShortcut = key;
    setTimeout(() => {
      if (this.pressedShortcut === key) this.pressedShortcut = null;
    }, 150);
  }

  /** Finds the repository behind a band label (display name) or its chart datum. */
  private findRepositoryForBand(band: string, chartDatum: any): Repository {
    return this.dataService.repositories.find(
      (r) => r.name === band || (chartDatum && (r.name === chartDatum.rawName || r.url === chartDatum.url)),
    );
  }

  /** Renders the total commit count of each student in a pill above his bar. */
  private renderCommitCountBadges(scaffold: StackedBarScaffold): void {
    const badgeGroup = scaffold.svg.append("g").attr("class", "badges");

    this.chartData.forEach((d) => {
      if (d.commitsCount > 0) {
        const badgeX = scaffold.x(d.student) + scaffold.x.bandwidth() / 2;
        const badgeY = scaffold.y(100) - 15; // slightly above the 100% bar

        // pill background
        badgeGroup
          .append("rect")
          .attr("x", badgeX - 16)
          .attr("y", badgeY - 10)
          .attr("width", 32)
          .attr("height", 20)
          .attr("rx", 10)
          .attr("ry", 10)
          .style("fill", "var(--color-surface)")
          .style("stroke", "var(--color-border)")
          .style("stroke-width", 1)
          .style("pointer-events", "none");

        // text
        badgeGroup
          .append("text")
          .attr("x", badgeX)
          .attr("y", badgeY + 4)
          .attr("text-anchor", "middle")
          .style("fill", "var(--color-text-primary)")
          .style("font-size", "10px")
          .style("font-weight", "bold")
          .style("pointer-events", "none")
          .text(d.commitsCount);
      }
    });
  }

  /**
   * Draws the line and dots of the questions progression (right axis), students without an
   * answered question being pinned to the bottom of the chart.
   */
  private renderProgressionLine(scaffold: StackedBarScaffold, yRight: d3.ScalePoint<string>): void {
    if (!this.showProgressionLine) {
      return;
    }

    const questionY = (d: any): number => (d.lastQuestionDone ? yRight(d.lastQuestionDone) || scaffold.height : scaffold.height);
    const line = d3
      .line<any>()
      .x((d) => scaffold.x(d.student) + scaffold.x.bandwidth() / 2)
      .y(questionY);

    scaffold.svg
      .append("path")
      .datum(this.chartData)
      .attr("fill", "none")
      .attr("stroke", "var(--color-primary)")
      .attr("stroke-width", 2)
      .attr("d", line);

    scaffold.svg
      .selectAll(".dot")
      .data(this.chartData)
      .enter()
      .append("circle")
      .classed("dot", true)
      .attr("cx", (d) => scaffold.x(d.student) + scaffold.x.bandwidth() / 2)
      .attr("cy", questionY)
      .attr("r", 4)
      .attr("fill", "var(--color-primary)")
      .attr("stroke", "var(--color-surface)")
      .attr("stroke-width", 2)
      .style("pointer-events", "none");
  }
}
