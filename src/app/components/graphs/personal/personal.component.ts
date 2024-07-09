import { Component, OnInit } from "@angular/core";
import { BaseGraphComponent } from "../base-graph.component";
import { DataService } from "../../../services/data.service";
import { CommitsService } from "../../../services/commits.service";
import { TranslateService } from "@ngx-translate/core";
import { LoaderService } from "../../../services/loader.service";
import { AssignmentsService } from "../../../services/assignments.service";
import { Repository } from "../../../models/Repository.model";
import { EmotionService } from "../../../services/emotion.service";

import * as d3 from "d3";
import { Utils } from "../../../services/utils";
import { Commit } from "../../../models/Commit.model";

@Component({
  selector: "personal",
  templateUrl: "./personal.component.html",
  styleUrls: ["./personal.component.scss"],
})
export class PersonalComponent extends BaseGraphComponent implements OnInit {
  svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
  axis_g: any;
  x_scale: d3.ScaleLinear<number, number, never>;
  inner_width: number;
  x_axis: d3.Axis<d3.AxisDomain>;
  inner_height: any;
  chart_svg: d3.Selection<any, any, any, any>;
  x_g: d3.Selection<any, any, any, any>;
  inner_margin: any;
  y_scale: d3.ScaleLinear<number, number, never>;
  y_axis: d3.Axis<d3.AxisDomain>;
  width: any;
  y_g: d3.Selection<any, any, any, any>;
  height: number;
  chart_width: number;
  data_g: d3.Selection<any, any, any, any>;
  dot_size: number;

  hovered_commit: Commit[];
  hovered_g: d3.Selection<SVGGElement, unknown, null, undefined>;

  commit_date_format = Utils.COMMIT_DATE_FORMAT;

  emotion_interval = [0, 7];
  difficulty_interval = [0, 7];
  dot_size_incr: number;

  /**
   * StudentsCommitsComponent constructor
   * @param dataService Service used to store and get data
   * @param translateService Service used to translate the application
   */
  constructor(
    public emotionService: EmotionService,
    public translateService: TranslateService,
    protected loaderService: LoaderService,
    protected assignmentsService: AssignmentsService
  ) {
    super(loaderService, assignmentsService, emotionService.dataService);
  }

  ngOnInit(): void {
    if (!this.emotionService.selection && this.getRepositories().length > 0) {
      this.emotionService.selection =
        this.getRepositories()[0].getDisplayName();
    }

    setTimeout(() => {
      this.translateService.onLangChange.subscribe(() => {
        this.loadGraphDataAndRefresh();
      });

      if (this.dataService.repoToLoad) {
        this.loadGraph();
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

  /**
   * Updates dict variable with students data and loads graph labels which displays data on the graph
   */
  loadGraphDataAndRefresh() {
    if (
      !this.getRepositories()
        .map((v) => v.getDisplayName())
        .includes(this.emotionService.selection)
    ) {
      this.emotionService.selection =
        this.getRepositories()[0]?.getDisplayName();
    }

    this.refresh();
  }

  updateVariableFromCss(): void {
    let chart_div = document.getElementById("chart");

    var style = getComputedStyle(chart_div);

    var css_var_number = (name: string, dash = true) =>
      Number.parseInt(style.getPropertyValue((dash ? "--" : "") + name));

    let rect = chart_div.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    this.inner_margin = {
      top: css_var_number("top-inner"),
      bottom: css_var_number("bottom-inner"),
      left: css_var_number("left-inner"),
    };

    this.inner_width = this.width;
    this.inner_height =
      this.height - this.inner_margin.top - this.inner_margin.bottom;

    this.dot_size = css_var_number("dot-size");
    this.dot_size_incr = css_var_number("dot-size-incr");
  }

  setupAxis() {
    if (this.axis_g != null) this.axis_g.remove();
    const inner_min = Math.min(this.inner_height, this.inner_width);

    this.x_scale = d3
      .scaleLinear()
      .domain(this.emotion_interval)
      .range([0, inner_min])
      .nice();

    this.x_axis = d3
      .axisBottom(this.x_scale)
      .tickValues(
        [...Array(this.emotion_interval[1] + 1).keys()].filter(
          (v) => v >= this.emotion_interval[0]
        )
      );

    this.axis_g = this.chart_svg.insert("g", ":first-child");

    this.x_g = this.chart_svg
      .append("g")
      .attr("transform", "translate(" + [0, this.inner_height] + ")")
      .call(this.x_axis);

    this.chart_svg
      .append("text") // text label for the x axis
      .attr("x", inner_min / 2)
      .attr("y", this.inner_height + 20)
      .style("font-size", "10px")
      .style("fill", "black")
      .style("text-anchor", "middle")
      .text(this.translateService.instant("PERSONAL-GRAPH.EMOTION"));

    this.y_scale = d3.scaleLinear().domain([7, 0]).range([0, inner_min]).nice();

    this.y_axis = d3
      .axisLeft(this.y_scale)
      .tickValues(
        [...Array(this.difficulty_interval[1] + 1).keys()].filter(
          (v) => v >= this.difficulty_interval[0]
        )
      );

    if (this.y_g != null) this.y_g.remove();
    this.y_g = this.axis_g.append("g").call(this.y_axis);

    this.chart_svg
      .append("text") // text label for the x axis
      .attr("x", -this.inner_margin.left)
      .attr("y", this.inner_height - inner_min / 2)
      .style("font-size", "10px")
      .style("fill", "black")
      .style("text-anchor", "start")
      .text(this.translateService.instant("PERSONAL-GRAPH.DIFFICULTY"));
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
        this.hovered_g = null;
      }
    }
  }

  refresh() {
    this.updateVariableFromCss();

    const personal = this;

    d3.select(".chart-container").on("mousemove", function (e) {
      personal.refreshTooltip(e.clientX, e.clientY);
    });

    if (this.svg != null) this.svg.remove();

    this.svg = d3
      .select(".chart-container")
      .append("svg")
      .attr("preserveAspectRatio", "none")
      .attr("viewBox", `0 0 ${this.width} ${this.height}`);

    const translation = [this.inner_margin.left, this.inner_margin.top];

    this.chart_svg = this.svg
      .append("g")
      .attr("transform", "translate(" + translation + ")");

    this.setupAxis();
    this.loadPoints();
  }

  loadPoints() {
    let repo = this.emotionService.getSelection();
    let data = this.emotionService.getData(repo);

    if (this.data_g != null) this.data_g.remove();
    if (repo == null || data == null || data.length == 0) return;
    this.data_g = this.chart_svg.append("g");

    const personal = this;

    const grid: any[][][] = [...Array(this.emotion_interval[1] + 1).keys()].map(
      (v) => [...Array(this.difficulty_interval[1] + 1).keys()].map((v) => [])
    );

    data.forEach((v) => {
      grid[v.emotion][v.difficulty].push(v);
    });

    grid.forEach((v, x) => {
      v.forEach((all, y) => {
        if (all.length == 0) return;
        let g = this.data_g.append("g");
        g.datum(all);
        g.append("circle")
          .attr("cx", `${personal.x_scale(x)}`)
          .attr("cy", `${personal.y_scale(y)}`)
          .attr(
            "r",
            personal.dot_size + personal.dot_size_incr * (all.length - 1)
          )
          .on("mouseenter", () => {
            console.log(all);
            personal.hovered_commit = all;
            personal.hovered_g = g;
          })
          .on("mouseleave", () => {
            if (personal.hovered_g === g) {
              personal.hovered_g = undefined;
              personal.hovered_commit = undefined;
            }
          });
      });
    });
  }

  loadGraph() {
    this.loading = true;
    this.loaderService.loadRepositories().subscribe(() => {
      this.loadGraphMetadata(
        this.dataService.repositories,
        this.dataService.reviews,
        this.dataService.corrections,
        this.dataService.questions
      );
      this.loading = false;
    });
  }

  getRepositories(): Repository[] {
    return this.dataService.repositories.filter(
      (repository) =>
        !this.dataService.groupFilter ||
        repository.tpGroup === this.dataService.groupFilter
    );
  }
}
