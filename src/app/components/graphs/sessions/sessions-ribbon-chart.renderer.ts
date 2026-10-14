import { ElementRef, TemplateRef } from "@angular/core";
import { DataService } from "@services/data.service";
import { TooltipService } from "@services/tooltip.service";
import { TranslateService } from "@ngx-translate/core";
import { SessionDetailedStats } from "@services/session-analytics.service";
import { Utils } from "@services/utils";
import { smartTooltipPlacement } from "./sessions-analytics.util";
import * as d3 from "d3";
import * as moment from "moment";

/**
 * Ribbon chart of a session: dispersion band (Q1-Q3), average trend line, one scatter point per
 * closing commit and the per-student trajectory shown on hover.
 *
 * Moved out of `SessionsComponent` to keep the view focused on state and events: all the D3 work
 * happens here, driven by the `host` members declared in {@link RibbonChartHost}.
 */

/** View members the ribbon chart needs from `SessionsComponent`. */
export interface RibbonChartHost {
  ribbonChartContainer?: ElementRef;
  d3TooltipTemplate: TemplateRef<any>;
  displayMode: "questions" | "commits";
  dataService: DataService;
  tooltipService: TooltipService;
  translateService: TranslateService;
  /** Warm-up state shared between the hovers (animation only for the first one). */
  trajectoryWarm: TrajectoryWarmState;
  getCurrentSessionStats(): SessionDetailedStats | null;
}

/**
 * Keeps the "trajectory already drawn" state between two hovers: the first hover animates the
 * progressive reveal, the next ones (within the grace delay) draw instantly.
 */
export class TrajectoryWarmState {
  private warm = false;
  private resetTimeout: any = null;

  constructor(private readonly resetDelayMs = 450) {}

  /** Tells whether the trajectory should be animated, and marks the warm-up as started. */
  public shouldAnimate(): boolean {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = null;
    }
    const animate = !this.warm;
    this.warm = true;
    return animate;
  }

  /** Grace period before the next hover animates again. */
  public scheduleReset(): void {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
    }
    this.resetTimeout = setTimeout(() => {
      this.warm = false;
      this.resetTimeout = null;
    }, this.resetDelayMs);
  }

  /** Drops the pending reset (component destroyed). */
  public cancel(): void {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = null;
    }
  }
}

export class SessionRibbonChartRenderer {
  /** Draws the whole ribbon chart inside `host.ribbonChartContainer`. */
  public static render(host: RibbonChartHost): void {
    if (!host.ribbonChartContainer?.nativeElement) return;
    const container = host.ribbonChartContainer.nativeElement;
    d3.select(container).selectAll("*").remove();

    const stats = host.getCurrentSessionStats();
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
    const isQuestions = host.displayMode === "questions";
    const questions = host.dataService.questions || [];
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
          ? host.translateService.instant("SESSIONS-GRAPH.RIBBON.Y_AXIS_QUESTIONS") || "Questions complétées"
          : host.translateService.instant("SESSIONS-GRAPH.RIBBON.Y_AXIS_COMMITS") || "Commits cumulés",
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

    // 2. Average Trend Line
    const line = d3
      .line<any>()
      .x((d) => xScale(d.time))
      .y((d) => yScale(d.mean))
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
          const { x: tX, y: tY, placement, customOffset } = smartTooltipPlacement(event.clientX, event.clientY, cx, cy);
          host.tooltipService.showAtPosition(
            host.d3TooltipTemplate,
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

          /* Warm-up : une trajectoire affichée récemment se dessine instantanément. */
          const shouldAnimate = host.trajectoryWarm.shouldAnimate();

          // Clear any ongoing trajectory transition immediately
          hoverTrajectoryGroup.selectAll("*").interrupt().remove();

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

            const lastPtTime = new Date(studentPoints[studentPoints.length - 1].time);
            const targetWidth = Math.min(innerWidth + 10, xScale(lastPtTime) + 8);

            if (shouldAnimate) {
              // Progressive reveal of dashed curve via clipPath (<300ms, strong ease-out)
              const clipId = "student-trajectory-clip-" + Math.random().toString(36).substring(2, 9);
              const clip = hoverTrajectoryGroup.append("defs").append("clipPath").attr("id", clipId);
              const clipRect = clip
                .append("rect")
                .attr("x", 0)
                .attr("y", -10)
                .attr("width", 0)
                .attr("height", innerHeight + 20);

              hoverTrajectoryGroup
                .append("path")
                .datum(curvePoints)
                .attr("class", "student-trajectory-line")
                .attr("clip-path", `url(#${clipId})`)
                .attr("d", studentLine)
                .style("fill", "none")
                .style("stroke", "var(--color-primary)")
                .style("stroke-width", "2px")
                .style("stroke-linecap", "round")
                .style("stroke-linejoin", "round")
                .style("stroke-dasharray", "4,3")
                .style("opacity", "0.95");

              clipRect.transition().duration(240).ease(d3.easeCubicOut).attr("width", Math.max(0, targetWidth));
            } else {
              // Warm state: render dashed line instantly without drawing animation
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
                .style("opacity", "0.95");
            }
          }
        })
        .on("mouseleave", () => {
          host.tooltipService.hide();

          // Smooth exit for trajectory line (exit faster than enter: ~120ms fade-out)
          hoverTrajectoryGroup
            .selectAll("path")
            .interrupt()
            .transition()
            .duration(120)
            .ease(d3.easeCubicOut)
            .style("opacity", "0")
            .remove();

          /* Warm-up reset : délai de grâce avant que la prochaine trajectoire ne soit animée. */
          host.trajectoryWarm.scheduleReset();

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
          .text(host.translateService.instant("SESSIONS-GRAPH.OFFICIAL_END") || "Fin officielle");
      }
    }
  }
}
