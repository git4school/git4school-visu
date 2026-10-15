import { ElementRef, TemplateRef } from "@angular/core";
import { TooltipService } from "@services/tooltip.service";
import { SessionDetailedStats } from "@services/session-analytics.service";

import * as d3 from "d3";
import moment from "moment";

/**
 * Two "macro" charts of the sessions view: the 15-minute pace histogram of one session and the
 * comparison of the participation rate across sessions.
 *
 * Moved out of `SessionsComponent` (which keeps only state and events); everything D3 lives here.
 */

/** Column geometry of the comparison chart. */
const MACRO_CHART_MIN_SLOT_WIDTH = 56;
const MACRO_CHART_MAX_SLOT_WIDTH = 190;
const MACRO_CHART_MAX_BAR_WIDTH = 64;
const MACRO_CHART_CHAR_WIDTH = 6.2;

/** View members the macro charts need from `SessionsComponent`. */
export interface MacroChartsHost {
  histogramChartContainer?: ElementRef;
  comparisonChartContainer?: ElementRef;
  macroChartScroller?: ElementRef<HTMLDivElement>;
  d3TooltipTemplate: TemplateRef<any>;
  tooltipService: TooltipService;
  getCurrentSessionStats(): SessionDetailedStats | null;
  getFilteredSessions(): SessionDetailedStats[];
  selectSession(index: number): void;
}

export class SessionMacroChartsRenderer {
  /** Pace histogram (one bar every 15 minutes) of the selected session. */
  public static renderHistogram(host: MacroChartsHost): void {
    if (!host.histogramChartContainer?.nativeElement) return;
    const container = host.histogramChartContainer.nativeElement;
    d3.select(container).selectAll("*").remove();

    const stats = host.getCurrentSessionStats();
    if (!stats || !stats.histogramBuckets || stats.histogramBuckets.length === 0) return;

    const bounds = container.getBoundingClientRect();
    const width = Math.max(300, bounds.width);
    const height = 210;
    const margin = { top: 20, right: 35, bottom: 40, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    const svg = d3.select(container).append("svg").attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const buckets = stats.histogramBuckets;
    const maxTotal = d3.max(buckets, (b) => b.total) || 1;

    const xScale = d3
      .scaleBand()
      .domain(buckets.map((b) => b.label))
      .range([0, innerWidth])
      .padding(0.25);

    const yScale = d3.scaleLinear().domain([0, maxTotal]).nice().range([innerHeight, 0]);

    // Grid lines
    g.append("g")
      .attr("class", "grid-lines")
      .style("stroke-opacity", "0.08")
      .call(
        d3
          .axisLeft(yScale)
          .ticks(4)
          .tickSize(-innerWidth)
          .tickFormat(() => ""),
      );

    // X Axis
    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll("text")
      .style("fill", "var(--color-text-secondary)")
      .style("font-size", "11px");

    // Y Axis
    g.append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(yScale).ticks(4))
      .selectAll("text")
      .style("fill", "var(--color-text-secondary)")
      .style("font-size", "11px");

    // Bars
    buckets.forEach((bucket) => {
      const bx = xScale(bucket.label);
      if (bx === undefined) return;
      const bWidth = xScale.bandwidth();

      // Stack colored segments
      let currentY = innerHeight;
      const colorKeys = ["intermediate", "green", "orange", "red"];

      colorKeys.forEach((colorKey) => {
        const count = bucket.countsByColor[colorKey] || 0;
        if (count <= 0) return;

        const segHeight = innerHeight - yScale(count);
        currentY -= segHeight;

        let col = "var(--color-commit-intermediate)";
        if (colorKey === "green") col = "var(--color-success)";
        else if (colorKey === "orange") col = "var(--color-warning)";
        else if (colorKey === "red") col = "var(--color-danger)";

        g.append("rect")
          .attr("x", bx)
          .attr("y", currentY)
          .attr("width", bWidth)
          .attr("height", segHeight)
          .attr("rx", 3)
          .style("fill", col)
          .style("cursor", "pointer")
          .on("mouseenter", (event: MouseEvent) => {
            const tooltipData = {
              isHistogram: true,
              slot: `${bucket.label} - ${moment(bucket.endDate).format("HH:mm")}`,
              totalCommits: bucket.total,
              closingCommits: bucket.closingCommitsCount,
            };
            host.tooltipService.showAtPosition(host.d3TooltipTemplate, event.clientX, event.clientY, "top", undefined, true, {
              tooltipData,
            });
          })
          .on("mouseleave", () => host.tooltipService.hide());
      });
    });
  }

  /**
   * Tracé D3.js de la vue Macro : Comparatif des séances
   */

  /** Comparaison du taux de participation entre les séances. */
  public static renderComparison(host: MacroChartsHost): void {
    if (!host.comparisonChartContainer?.nativeElement) return;
    const container = host.comparisonChartContainer.nativeElement;
    d3.select(container).selectAll("*").remove();

    const filtered = host.getFilteredSessions();
    if (filtered.length === 0) return;

    const bounds = (host.macroChartScroller?.nativeElement ?? container).getBoundingClientRect();
    if (bounds.width <= 0) return;

    const height = 260;
    const margin = { top: 14, right: 35, bottom: 45, left: 50 };

    const labels = filtered.map((s) => s.displayName);
    const slotWidth = computeMacroSlotWidth(labels);

    // The chart grows horizontally beyond its wrapper, which scrolls (see .macro-chart-scroll-wrapper).
    const width = Math.max(bounds.width, labels.length * slotWidth + margin.left + margin.right);
    container.style.width = `${width}px`;

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    const svg = d3.select(container).append("svg").attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleBand().domain(labels).range([0, innerWidth]).padding(0.3);

    const yScale = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);

    // Grid lines
    g.append("g")
      .attr("class", "grid-lines")
      .style("stroke-opacity", "0.08")
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickSize(-innerWidth)
          .tickFormat(() => ""),
      );

    // Axes
    const xAxis = g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(xScale));

    xAxis
      .selectAll("text")
      .text((label) => truncateMacroLabel(`${label}`, slotWidth))
      .attr("title", (label) => `${label}`)
      .style("fill", "var(--color-text-secondary)")
      .style("font-size", "11px");

    g.append("g")
      .attr("class", "y-axis")
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickFormat((d) => `${d}%`),
      )
      .selectAll("text")
      .style("fill", "var(--color-text-secondary)")
      .style("font-size", "11px");

    // Bars
    filtered.forEach((stat, i) => {
      const bandX = xScale(stat.displayName);
      if (bandX === undefined) return;
      // Keep bars slim and centered inside their (possibly very wide) column.
      const bandWidth = xScale.bandwidth();
      const bWidth = Math.min(bandWidth, MACRO_CHART_MAX_BAR_WIDTH);
      const bx = bandX + (bandWidth - bWidth) / 2;
      const bHeight = innerHeight - yScale(stat.participationRate);

      g.append("rect")
        .attr("x", bx)
        .attr("y", yScale(stat.participationRate))
        .attr("width", bWidth)
        .attr("height", bHeight)
        .attr("rx", 4)
        .style("fill", "var(--color-primary)")
        .style("opacity", "0.85")
        .style("cursor", "pointer")
        .on("mouseenter", function () {
          d3.select(this).style("opacity", "1");
        })
        .on("mouseleave", function () {
          d3.select(this).style("opacity", "0.85");
        })
        .on("click", () => {
          host.selectSession(i);
        });

      // Percentage label on top of bar
      g.append("text")
        .attr("x", bx + bWidth / 2)
        .attr("y", yScale(stat.participationRate) - 6)
        .attr("text-anchor", "middle")
        .style("fill", "var(--color-text-primary)")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .text(`${Math.round(stat.participationRate)}%`);
    });
  }
}

/**
 * Largeur minimale d'une colonne du graphique macro, déduite du libellé de séance le plus long
 * pour éviter que les libellés de l'axe X se chevauchent quand il y a beaucoup de séances.
 */
function computeMacroSlotWidth(labels: string[]): number {
  const longestLabel = labels.reduce((max, label) => Math.max(max, (label || "").length), 0);
  const required = longestLabel * MACRO_CHART_CHAR_WIDTH + 20;

  return Math.min(MACRO_CHART_MAX_SLOT_WIDTH, Math.max(MACRO_CHART_MIN_SLOT_WIDTH, required));
}

function truncateMacroLabel(label: string, slotWidth: number): string {
  const maxChars = Math.floor((slotWidth - 10) / MACRO_CHART_CHAR_WIDTH);
  if (maxChars < 4 || label.length <= maxChars) return label;

  return `${label.slice(0, maxChars - 1)}…`;
}
