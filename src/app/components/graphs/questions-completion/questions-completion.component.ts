import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
  ViewEncapsulation,
} from "@angular/core";
import { CommitColor } from "@models/Commit.model";
import { TranslateService } from "@ngx-translate/core";
import { AssignmentsService } from "@services/assignments.service";
import { CommitsService } from "@services/commits.service";
import { DataService } from "@services/data.service";
import { LoaderService } from "@services/loader.service";
import { TooltipService } from "@services/tooltip.service";
import { ThemeService } from "@services/theme.service";
import { Subscription } from "rxjs";
import { BaseGraphComponent } from "../base-graph.component";
import { Utils } from "../../../services/utils";
import * as d3 from "d3";

@Component({
  selector: "questions-completion",
  templateUrl: "./questions-completion.component.html",
  styleUrls: ["./questions-completion.component.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class QuestionsCompletionComponent
  extends BaseGraphComponent
  implements OnInit, OnDestroy
{
  @ViewChild("chartContainer", { static: true }) chartContainer: ElementRef;
  @ViewChild("leftAxisContainer", { static: true }) leftAxisContainer: ElementRef;
  @ViewChild("d3TooltipTemplate") d3TooltipTemplate!: TemplateRef<any>;

  readonly slider_step = Utils.SLIDER_STEP;
  assignmentsModified$: Subscription;

  date: number;
  min: number;
  max: number;
  dict = {};
  chartData: any[] = [];
  
  commitColors = [
    CommitColor.INTERMEDIATE,
    CommitColor.BEFORE,
    CommitColor.BETWEEN,
    CommitColor.AFTER,
    CommitColor.NOCOMMIT,
  ];
  hiddenCategories = new Set<string>();

  private svg: any;
  private resizeObserver: any;

  constructor(
    public dataService: DataService,
    private commitsService: CommitsService,
    public translateService: TranslateService,
    protected loaderService: LoaderService,
    protected assignmentsService: AssignmentsService,
    private tooltipService: TooltipService,
    public themeService: ThemeService
  ) {
    super(loaderService, assignmentsService, dataService);
  }

  ngOnInit() {
    setTimeout(() => {
      this.assignmentsModified$ = this.subscribeAssignmentModified();
      this.translateService.onLangChange.subscribe(() => {
        this.loadGraphDataAndRefresh();
      });

      if (this.dataService.repoToLoad) {
        this.loadGraph(this.dataService.startDate, this.dataService.endDate);
      } else {
        this.loading = true;
        this.initDateSlider();
        this.loadGraphMetadata(
          this.dataService.repositories,
          this.dataService.reviews,
          this.dataService.corrections,
          this.dataService.questions
        );
        this.loading = false;
      }

      this.resizeObserver = new (window as any).ResizeObserver(() => {
        if (this.chartData && this.chartData.length > 0) {
          this.drawGraph();
        }
      });
      this.resizeObserver.observe(this.chartContainer.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeAssignmentModified(this.assignmentsModified$);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  loadGraphDataAndRefresh() {
    let translations = this.translateService.instant([
      "QUESTION",
      "COMMITS-COUNT",
      "COMMITS-PERCENTAGE",
      "STUDENTS"
    ]);

    let colors = [
      CommitColor.BEFORE,
      CommitColor.BETWEEN,
      CommitColor.AFTER,
      CommitColor.NOCOMMIT,
    ];

    let dict = this.commitsService.initQuestionsDict(
      this.dataService.questions,
      colors
    );
    dict = this.commitsService.loadQuestionsDict(
      dict,
      this.dataService.repositories,
      this.dataService.questions,
      colors,
      this.dataService.groupFilter,
      this.date
    );

    this.chartData = this.commitsService.loadQuestions(
      dict,
      colors,
      this.dataService.questions,
      translations
    );

    this.drawGraph();
  }

  drawGraph() {
    const element = this.chartContainer.nativeElement;
    const leftElement = this.leftAxisContainer.nativeElement;
    d3.select(element).selectAll("*").remove();
    d3.select(leftElement).selectAll("*").remove();

    if (!this.chartData || this.chartData.length === 0) return;

    const margin = { top: 40, right: 30, bottom: 60, left: 60 };
    const minBarWidth = 100;
    const requiredWidth = this.chartData.length * minBarWidth;
    const width = Math.max(element.clientWidth - margin.left - margin.right, requiredWidth);
    const height = element.clientHeight - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    this.svg = d3
      .select(element)
      .append("svg")
      .style("display", "block")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const colors = [
      CommitColor.BEFORE,
      CommitColor.BETWEEN,
      CommitColor.AFTER,
      CommitColor.NOCOMMIT,
    ];

    const keys = colors.map((c) => c.label).filter(k => !this.hiddenCategories.has(k));
    const stackedData = d3.stack().keys(keys)(this.chartData);

    // Scales
    const x = d3
      .scaleBand()
      .domain(this.chartData.map((d) => d.question))
      .range([0, width])
      .padding(0.3);

    const y = d3.scaleLinear().domain([0, 100]).range([height, 0]);

    // Axes
    this.svg
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)")
      .style("fill", "var(--color-text-primary)")
      .style("font-size", "12px");

    const svgLeft = d3.select(leftElement).append("svg")
      .style("display", "block")
      .attr("width", margin.left)
      .attr("height", height + margin.top + margin.bottom)
      .style("pointer-events", "none");

    const leftPath = `M 0 0 L ${margin.left} 0 L ${margin.left} ${margin.top + height} L ${margin.left - margin.bottom} ${margin.top + height + margin.bottom} L 0 ${margin.top + height + margin.bottom} Z`;
    svgLeft.append("path")
      .attr("d", leftPath)
      .attr("fill", "var(--color-bg-body)")
      .style("pointer-events", "auto");

    const leftG = svgLeft
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)
      .style("pointer-events", "auto");
      
    leftG.call(d3.axisLeft(y).ticks(10).tickFormat((d) => d + "%"))
      .selectAll("text")
      .style("fill", "var(--color-text-primary)")
      .style("font-size", "12px");
      
    leftG.selectAll(".domain").remove();
    leftG.selectAll(".tick line").remove();

    // Left Y-Axis Label
    leftG.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - 60 + 5)
      .attr("x", 0 - (height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("fill", "var(--color-text-secondary)")
      .style("font-size", "12px")
      .text(this.translateService.instant("PERCENT-COMMITS"));

    // Gridlines
    const yAxisGrid = d3.axisLeft(y).tickSize(-width).tickFormat(() => "").ticks(10);
    this.svg
      .append("g")
      .attr("class", "grid")
      .call(yAxisGrid)
      .selectAll("line")
      .style("stroke", "var(--color-border)")
      .style("stroke-opacity", "0.5")
      .style("shape-rendering", "crispEdges");

    // Remove domain lines for cleaner look
    this.svg.selectAll(".domain").remove();

    // Custom horizontal gridline (barIndex feature)
    const targetPercentage = this.dataService.barIndex * 10;
    this.svg
      .append("line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", y(targetPercentage))
      .attr("y2", y(targetPercentage))
      .style("stroke", CommitColor.AFTER.color)
      .style("stroke-width", 3)
      .style("stroke-dasharray", "5,5");

    // Draw Bars
    const visibleColors = colors.filter(c => !this.hiddenCategories.has(c.label));

    const groups = this.svg
      .selectAll("g.layer")
      .data(stackedData)
      .enter()
      .append("g")
      .classed("layer", true)
      .style("fill", (d, i) => visibleColors[i].color);

    groups
      .selectAll("rect")
      .data((d) => d)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.data.question))
      .attr("y", (d) => y(d[1]))
      .attr("height", (d) => y(d[0]) - y(d[1]))
      .attr("width", x.bandwidth())
      .attr("rx", 2)
      .attr("ry", 2)
      .style("cursor", "default")
      .style("transition", "opacity 0.2s")
      .on("mouseover", (event, d) => {
        d3.select(event.currentTarget).style("opacity", 0.8);
      })
      .on("mousemove", (event, d) => {
        // Find which key this data point belongs to
        const layerData = d3.select(event.currentTarget.parentNode).datum() as any;
        const key = layerData.key;
        const colorObj = colors.find(c => c.label === key);
        const dataObj = d.data[key + "_data"];
        
        if (dataObj) {
          const colorObj = this.commitColors.find(c => c.label === key);
          const tooltipData = {
            question: d.data.question,
            category: key,
            categoryKey: colorObj ? colorObj.labelKey : key,
            count: dataObj.count,
            percentage: d.data[key],
            students: dataObj.students.map((s) => Utils.truncateMiddle(s.name, 25)),
          };

          if (!this.tooltipService.isShowing()) {
            this.tooltipService.showAtPosition(
              this.d3TooltipTemplate,
              event.clientX,
              event.clientY,
              "right",
              undefined,
              true,
              { tooltipData }
            );
          } else {
            this.tooltipService.moveTooltip(event.clientX, event.clientY, "right");
          }
        }
      })
      .on("mouseout", (event) => {
        d3.select(event.currentTarget).style("opacity", 1);
        this.tooltipService.hide();
      });
      
    // Add text labels inside bars if large enough
    groups
      .selectAll("text.bar-label")
      .data((d) => d)
      .enter()
      .append("text")
      .classed("bar-label", true)
      .attr("x", (d) => x(d.data.question) + x.bandwidth() / 2)
      .attr("y", (d) => y(d[1]) + (y(d[0]) - y(d[1])) / 2)
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .style("fill", function() {
        const layerData = d3.select(this.parentNode).datum() as any;
        if (layerData.key === "Not finished") {
          return "var(--color-text-primary)";
        }
        return "white";
      })
      .style("font-size", "11px")
      .style("font-weight", "bold")
      .style("pointer-events", "none")
      .text(function(d) {
        const percentage = d[1] - d[0];
        if (percentage > 5) {
          // Find the actual count
          const layerData = d3.select(this.parentNode).datum() as any;
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

  onScroll(event: Event) {
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
        this.dataService.questions
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
          (v) => v.commitDate
        );

        this.min = interval[0].getTime();
        this.max = interval[1].getTime();
      }
    }
  }

  getAdjustedMaxTimestamp() {
    return (
      Math.ceil((this.max - this.min) / this.slider_step) * this.slider_step +
      this.min
    );
  }

  pressedShortcut: string = null;

  @HostListener("document:keydown", ["$event"])
  handleGlobalShortcuts(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
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
