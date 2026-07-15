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
  selector: "students-commits",
  templateUrl: "./students-commits.component.html",
  styleUrls: ["./students-commits.component.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class StudentsCommitsComponent
  extends BaseGraphComponent
  implements OnInit, OnDestroy
{
  @ViewChild("chartContainer", { static: true }) chartContainer: ElementRef;
  @ViewChild("d3TooltipTemplate") d3TooltipTemplate!: TemplateRef<any>;

  readonly slider_step = Utils.SLIDER_STEP;
  assignmentsModified$: Subscription;

  date: number;
  min: number;
  max: number;
  chartData: any[] = [];
  
  commitColors = [
    CommitColor.INTERMEDIATE,
    CommitColor.BEFORE,
    CommitColor.BETWEEN,
    CommitColor.AFTER,
  ];
  hiddenCategories = new Set<string>();
  showProgressionLine = true;

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
      "STUDENT",
      "COMMITS-COUNT",
      "COMMITS-PERCENTAGE",
    ]);
    let colors = [
      CommitColor.INTERMEDIATE,
      CommitColor.BEFORE,
      CommitColor.BETWEEN,
      CommitColor.AFTER,
    ];

    let dict = this.commitsService.loadStudentsDict(
      this.dataService.repositories,
      this.dataService.questions,
      colors,
      this.dataService.groupFilter,
      this.date
    );

    // Get an array of repositories (students) filtered
    const labels = this.dataService.repositories
      .filter(
        (repository) =>
          !this.dataService.groupFilter ||
          repository.tpGroup === this.dataService.groupFilter
      )
      .map((repository) => repository.name);

    // Convert dict back to an ordered array according to labels
    this.chartData = labels.map((label) => {
      let studentData = dict[label];
      let result: any = {
        student: studentData.name,
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

  drawGraph() {
    const element = this.chartContainer.nativeElement;
    d3.select(element).selectAll("*").remove();

    if (!this.chartData || this.chartData.length === 0) return;

    const margin = { top: 40, right: 80, bottom: 100, left: 60 };
    const width = element.clientWidth - margin.left - margin.right;
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
      CommitColor.INTERMEDIATE,
      CommitColor.BEFORE,
      CommitColor.BETWEEN,
      CommitColor.AFTER,
    ];

    const keys = colors.map((c) => c.label).filter(k => !this.hiddenCategories.has(k));
    const stackedData = d3.stack().keys(keys)(this.chartData);

    // X Scale: Students
    const x = d3
      .scaleBand()
      .domain(this.chartData.map((d) => d.student))
      .range([0, width])
      .padding(0.3);

    // Y Scale Left: Percentages (0-100)
    const yLeft = d3.scaleLinear().domain([0, 100]).range([height, 0]);

    // Y Scale Right: Questions
    const questionsList = this.dataService.questions ? this.dataService.questions.slice() : [];
    const yRight = d3
      .scalePoint()
      .domain(questionsList)
      .range([height - 15, 15])
      .padding(0);

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
      .style("font-size", "11px");

    // Left Y-Axis
    this.svg
      .append("g")
      .call(d3.axisLeft(yLeft).ticks(10).tickFormat((d) => d + "%"))
      .selectAll("text")
      .style("fill", "var(--color-text-primary)")
      .style("font-size", "11px");

    // Left Y-Axis Label
    this.svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left + 5)
      .attr("x", 0 - (height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("fill", "var(--color-text-secondary)")
      .style("font-size", "11px")
      .text(this.translateService.instant("PERCENT-COMMITS"));

    // Right Y-Axis
    this.svg
      .append("g")
      .attr("transform", `translate(${width}, 0)`)
      .call(d3.axisRight(yRight))
      .selectAll("text")
      .style("fill", "var(--color-text-primary)")
      .style("font-size", "11px");

    // Right Y-Axis Label
    this.svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", width + margin.right - 5)
      .attr("x", 0 - (height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("fill", "var(--color-text-secondary)")
      .style("font-size", "11px")
      .text(this.translateService.instant("QUESTIONS"));

    // Gridlines for left axis
    const yAxisGrid = d3.axisLeft(yLeft).tickSize(-width).tickFormat(() => "").ticks(10);
    this.svg
      .append("g")
      .attr("class", "grid")
      .call(yAxisGrid)
      .selectAll("line")
      .style("stroke", "var(--color-border)")
      .style("stroke-opacity", "0.5")
      .style("shape-rendering", "crispEdges");

    this.svg.selectAll(".domain").remove();

    // Hover background rects
    this.svg
      .append("g")
      .selectAll("rect.hover-bg")
      .data(this.chartData)
      .enter()
      .append("rect")
      .attr("class", "hover-bg")
      .attr("x", (d) => x(d.student) - x.bandwidth() * 0.1)
      .attr("y", 0)
      .attr("width", x.bandwidth() * 1.2)
      .attr("height", height)
      .style("fill", "transparent")
      .on("mouseover", (event, d) => this.showTooltip(event, d, colors))
      .on("mousemove", (event) => {
        if (this.tooltipService.isShowing()) {
          this.tooltipService.moveTooltip(event.clientX, event.clientY, "right");
        }
      })
      .on("mouseout", () => this.tooltipService.hide());

    // Draw Stacked Bars
    const visibleColors = colors.filter(c => !this.hiddenCategories.has(c.label));

    const groups = this.svg
      .selectAll("g.layer")
      .data(stackedData)
      .enter()
      .append("g")
      .classed("layer", true)
      .style("fill", (d, i) => visibleColors[i].color);

    groups
      .selectAll("rect.bar")
      .data((d) => d)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d) => x(d.data.student))
      .attr("y", (d) => yLeft(d[1]))
      .attr("height", (d) => {
        const h = yLeft(d[0]) - yLeft(d[1]);
        return isNaN(h) ? 0 : h;
      })
      .attr("width", x.bandwidth())
      .style("pointer-events", "none");

    // Badges for total commits (on top of each bar)
    const badgeGroup = this.svg.append("g").attr("class", "badges");
    
    this.chartData.forEach(d => {
      if (d.commitsCount > 0) {
        const badgeX = x(d.student) + x.bandwidth() / 2;
        const badgeY = yLeft(100) - 15; // slightly above the 100% bar
        
        // pill background
        badgeGroup.append("rect")
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
        badgeGroup.append("text")
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

    // Draw Line and Dots
    if (this.showProgressionLine) {
      const line = d3
        .line<any>()
        .x((d) => x(d.student) + x.bandwidth() / 2)
        .y((d) => {
          if (!d.lastQuestionDone) return height;
          return yRight(d.lastQuestionDone) || height;
        });

      this.svg
        .append("path")
        .datum(this.chartData)
        .attr("fill", "none")
        .attr("stroke", "var(--color-primary)")
        .attr("stroke-width", 2)
        .attr("d", line);

      this.svg
        .selectAll(".dot")
        .data(this.chartData)
        .enter()
        .append("circle")
        .classed("dot", true)
        .attr("cx", (d) => x(d.student) + x.bandwidth() / 2)
        .attr("cy", (d) => {
          if (!d.lastQuestionDone) return height;
          return yRight(d.lastQuestionDone) || height;
        })
        .attr("r", 4)
        .attr("fill", "var(--color-primary)")
        .attr("stroke", "var(--color-surface)")
        .attr("stroke-width", 2)
        .style("pointer-events", "none");
    }
  }

  showTooltip(event: MouseEvent, data: any, colors: any[]) {
    const stats = colors.map(c => {
      return {
        label: c.label,
        labelKey: c.labelKey,
        color: c.color,
        percentage: data[c.label],
        count: data[c.label + "_data"]?.commitsCount || 0
      };
    }).filter(s => s.count > 0);

    const tooltipData = {
      student: data.student,
      commitsCount: data.commitsCount,
      lastQuestionDone: data.lastQuestionDone,
      stats: stats
    };

    this.tooltipService.showAtPosition(
      this.d3TooltipTemplate,
      event.clientX,
      event.clientY,
      "right",
      undefined,
      true,
      { tooltipData }
    );
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

  toggleProgressionLine() {
    this.showProgressionLine = !this.showProgressionLine;
    this.drawGraph();
  }
}
