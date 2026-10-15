import { Component, ElementRef, HostListener, OnDestroy, OnInit, TemplateRef, ViewChild, ViewEncapsulation } from "@angular/core";
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
import { StackedBarChart } from "../shared/stacked-bar-chart";
import { Utils } from "../../../services/utils";
import { OsUtils } from "@utils/os.utils";
import * as d3 from "d3";

@Component({
  selector: "questions-completion",
  templateUrl: "./questions-completion.component.html",
  styleUrls: ["./questions-completion.component.scss"],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class QuestionsCompletionComponent extends BaseGraphComponent implements OnInit, OnDestroy {
  @ViewChild("chartContainer", { static: true }) chartContainer: ElementRef;
  @ViewChild("leftAxisContainer", { static: true }) leftAxisContainer: ElementRef;
  @ViewChild("d3TooltipTemplate") d3TooltipTemplate!: TemplateRef<any>;

  readonly slider_step = Utils.SLIDER_STEP;
  assignmentsModified$: Subscription;
  groupFilterSub: Subscription;

  date: number;
  min: number;
  max: number;
  dict = {};
  chartData: any[] = [];

  commitColors = [CommitColor.INTERMEDIATE, CommitColor.BEFORE, CommitColor.BETWEEN, CommitColor.AFTER, CommitColor.NOCOMMIT];
  hiddenCategories = new Set<string>();

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
  ) {
    super(loaderService, assignmentsService, dataService, translateService, anonymizationService);
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
    let translations = this.translateService.instant(["QUESTION", "COMMITS-COUNT", "COMMITS-PERCENTAGE", "STUDENTS"]);

    let colors = [CommitColor.BEFORE, CommitColor.BETWEEN, CommitColor.AFTER, CommitColor.NOCOMMIT];

    let dict = this.commitsService.initQuestionsDict(this.dataService.questions, colors);
    dict = this.commitsService.loadQuestionsDict(
      dict,
      this.dataService.repositories,
      this.dataService.questions,
      colors,
      this.dataService.groupFilter,
      this.date,
    );

    this.chartData = this.commitsService.loadQuestions(dict, colors, this.dataService.questions, translations);

    this.drawGraph();
  }

  drawGraph() {
    const element = this.chartContainer.nativeElement;
    const leftElement = this.leftAxisContainer.nativeElement;

    if (!StackedBarChart.prepare([element, leftElement], this.chartData ? this.chartData.length : 0)) {
      return;
    }

    const colors = [CommitColor.BEFORE, CommitColor.BETWEEN, CommitColor.AFTER, CommitColor.NOCOMMIT];
    const scaffold = StackedBarChart.createScaffold(
      element,
      this.chartData.map((d) => d.question),
      {
        margin: { top: 40, right: 30, bottom: 60, left: 60 },
        minBarWidth: 100,
      },
    );

    if (!scaffold) {
      return;
    }

    this.svg = scaffold.svg;

    StackedBarChart.renderBottomAxis(scaffold, { color: "var(--color-text-primary)" });
    StackedBarChart.renderLeftPercentAxis(leftElement, scaffold, this.translateService.instant("PERCENT-COMMITS"));
    StackedBarChart.renderGrid(scaffold);

    // Custom horizontal gridline (barIndex feature)
    const targetPercentage = this.dataService.barIndex * 10;
    this.svg
      .append("line")
      .attr("x1", 0)
      .attr("x2", scaffold.width)
      .attr("y1", scaffold.y(targetPercentage))
      .attr("y2", scaffold.y(targetPercentage))
      .style("stroke", CommitColor.AFTER.color)
      .style("stroke-width", 3)
      .style("stroke-dasharray", "5,5");

    const keys = colors.map((c) => c.label).filter((k) => !this.hiddenCategories.has(k));
    const stackedData = d3.stack().keys(keys)(this.chartData);
    const visibleColors = colors.filter((c) => !this.hiddenCategories.has(c.label));

    // Draw Bars
    const groups = StackedBarChart.renderLayers(scaffold, stackedData, visibleColors, (d) => d.data.question, {
      radius: 2,
      cursor: "default",
      onMouseOver: (event, d, rect) => {
        d3.select(rect).style("opacity", 0.8);
      },
      onMouseMove: (event, d, rect) => {
        // Find which key this data point belongs to
        const layerData = d3.select(rect.parentNode as Element).datum() as any;
        const key = layerData.key;
        const dataObj = d.data[key + "_data"];

        if (dataObj) {
          const colorObj = this.commitColors.find((c) => c.label === key);
          const tooltipData = {
            question: d.data.question,
            category: key,
            categoryKey: colorObj ? colorObj.labelKey : key,
            count: dataObj.count,
            percentage: d.data[key],
            students: dataObj.students.map((s) => {
              const repo = this.dataService.repositories?.find((r) => r.name === s.name || (s.url && r.url === s.url));
              const displayName = repo
                ? this.anonymizationService.getDisplayName(repo)
                : this.anonymizationService.getAnonymizedName(s.name);
              return Utils.truncateMiddle(displayName, 25);
            }),
          };

          if (!this.tooltipService.isShowing()) {
            this.tooltipService.showAtPosition(this.d3TooltipTemplate, event.clientX, event.clientY, "right", undefined, true, {
              tooltipData,
            });
          } else {
            this.tooltipService.moveTooltip(event.clientX, event.clientY, "right");
          }
        }
      },
      onMouseOut: (event, d, rect) => {
        d3.select(rect).style("opacity", 1);
        this.tooltipService.hide();
      },
    });

    // Add text labels inside bars if large enough
    groups
      .selectAll<SVGTextElement, any>("text.bar-label")
      .data((d) => d)
      .enter()
      .append("text")
      .classed("bar-label", true)
      .attr("x", (d: any) => scaffold.x(d.data.question) + scaffold.x.bandwidth() / 2)
      .attr("y", (d: any) => scaffold.y(d[1]) + (scaffold.y(d[0]) - scaffold.y(d[1])) / 2)
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .style("fill", function () {
        const layerData = d3.select(this.parentNode as Element).datum() as any;
        if (layerData.key === "Not finished") {
          return "var(--color-text-primary)";
        }
        return "white";
      })
      .style("font-size", "11px")
      .style("font-weight", "bold")
      .style("pointer-events", "none")
      .text(function (this: SVGTextElement, d: any) {
        const percentage = d[1] - d[0];
        if (percentage > 5) {
          // Find the actual count
          const layerData = d3.select(this.parentNode as Element).datum() as any;
          const key = layerData.key;
          const dataObj = d.data[key + "_data"];
          if (dataObj && dataObj.count > 0) {
            return `${dataObj.count} (${percentage.toFixed(0)}%)`;
          }
        }
        return "";
      });
  }

  updateBar() {
    this.drawGraph();
  }

  onScroll(_event: Event) {
    // Left empty since CSS positioning takes over, but retained if needed
  }

  changeBarIndex() {
    this.updateBar();
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

  pressedShortcut: string = null;

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

  private triggerShortcut(key: string) {
    this.pressedShortcut = key;
    setTimeout(() => {
      if (this.pressedShortcut === key) this.pressedShortcut = null;
    }, 150);
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
}
