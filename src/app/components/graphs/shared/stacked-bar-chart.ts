import * as d3 from "d3";

/**
 * Shared D3 scaffolding for the stacked bar charts (students view and questions completion view).
 *
 * Both views draw the same skeleton: a main SVG with a percentage Y axis, a slanted left pane
 * (and an optional right pane) whose path fills the chart corner, gridlines, and one stacked layer
 * per commit category. Only the band key (student / question), the axis font size and the bar
 * decorations differ, so they are passed as options.
 */

/** Margins around the plot area, mirrored by the axis panes. */
export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface StackedBarOptions {
  margin: ChartMargin;
  /** Minimum width reserved per band, so bars never become unreadable. */
  minBarWidth: number;
  /** Font size of the axis labels. */
  axisFontSize?: number;
}

export interface StackedBarScaffold {
  svg: d3.Selection<SVGGElement, any, any, any>;
  x: d3.ScaleBand<string>;
  /** Percentage scale shared by the bars and the left axis. */
  y: d3.ScaleLinear<number, number>;
  width: number;
  height: number;
  margin: ChartMargin;
}

/** Per-bar rendering options, used to keep the slight visual differences between both views. */
export interface StackedBarRectOptions {
  /** Extra CSS class put on every bar rect. */
  className?: string;
  /** Corner radius of the bars. */
  radius?: number;
  /** Whether the bars should ignore pointer events (hover handled by background rects). */
  pointerEventsNone?: boolean;
  /** CSS cursor applied on the bars. */
  cursor?: string;
  /** Keeps the original signature so callers can read the datum and the rect. */
  onMouseOver?: (event: MouseEvent, datum: any, rect: SVGRectElement) => void;
  onMouseMove?: (event: MouseEvent, datum: any, rect: SVGRectElement) => void;
  onMouseOut?: (event: MouseEvent, datum: any, rect: SVGRectElement) => void;
}

export class StackedBarChart {
  /** Empties the given containers and tells whether the caller has data to draw. */
  public static prepare(containers: HTMLElement[], dataCount: number): boolean {
    containers.forEach((container) => d3.select(container).selectAll("*").remove());
    return dataCount > 0;
  }

  /**
   * Appends the main SVG with its scales.
   * @param domain Band labels (students or questions)
   * @returns The scaffold, or `null` when the container is too small to draw
   */
  public static createScaffold(container: HTMLElement, domain: string[], options: StackedBarOptions): StackedBarScaffold | null {
    const { margin, minBarWidth } = options;
    const width = Math.max(container.clientWidth - margin.left - margin.right, domain.length * minBarWidth);
    const height = container.clientHeight - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) {
      return null;
    }

    const svg = d3
      .select(container)
      .append("svg")
      .style("display", "block")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().domain(domain).range([0, width]).padding(0.3);
    const y = d3.scaleLinear().domain([0, 100]).range([height, 0]);

    return { svg, x, y, width, height, margin };
  }

  /**
   * Draws the bottom axis with its labels rotated by -45°.
   * @param options Font size of the labels and, when given, their fill colour (some views rely on CSS instead)
   * @returns The label selection, so the caller can truncate or decorate them
   */
  public static renderBottomAxis(
    scaffold: StackedBarScaffold,
    options: { fontSize?: number; color?: string } = {},
  ): d3.Selection<any, any, any, any> {
    const axis = scaffold.svg.append("g").attr("transform", `translate(0,${scaffold.height})`).call(d3.axisBottom(scaffold.x));

    const labels = axis
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)")
      .style("font-size", `${options.fontSize ?? 12}px`);

    if (options.color) {
      labels.style("fill", options.color);
    }

    return labels;
  }

  /**
   * Draws the left percentage axis in its own slanted pane.
   * @param label Already translated axis label
   * @returns The axis group, so the caller can decorate it further
   */
  public static renderLeftPercentAxis(
    container: HTMLElement,
    scaffold: StackedBarScaffold,
    label: string,
    axisFontSize = 12,
  ): d3.Selection<SVGGElement, any, any, any> {
    const { margin, height } = scaffold;
    const bottom = margin.top + height;
    const pane = this.createPane(container, margin.left, height + margin.top + margin.bottom);
    pane
      .append("path")
      .attr(
        "d",
        `M 0 0 L ${margin.left} 0 L ${margin.left} ${bottom} L ${margin.left - margin.bottom} ${bottom + margin.bottom} L 0 ${
          bottom + margin.bottom
        } Z`,
      )
      .attr("fill", "var(--color-bg-body)")
      .style("pointer-events", "auto");

    const group = pane.append("g").attr("transform", `translate(${margin.left},${margin.top})`).style("pointer-events", "auto");

    group
      .call(
        d3
          .axisLeft(scaffold.y)
          .ticks(10)
          .tickFormat((value) => value + "%"),
      )
      .selectAll("text")
      .style("fill", "var(--color-text-primary)")
      .style("font-size", `${axisFontSize}px`);

    this.removeDomains(group);

    group
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - 60 + 5)
      .attr("x", 0 - height / 2)
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("fill", "var(--color-text-secondary)")
      .style("font-size", "12px")
      .text(label);

    return group;
  }

  /**
   * Draws a right axis in its own slanted pane, mirroring the left one.
   * @returns The axis group, so the caller can decorate it further
   */
  public static renderRightAxis(
    container: HTMLElement,
    scaffold: StackedBarScaffold,
    y: d3.ScalePoint<string>,
    label: string,
    axisFontSize = 12,
  ): d3.Selection<SVGGElement, any, any, any> {
    const { margin, height } = scaffold;
    const bottom = margin.top + height;
    const paneWidth = margin.right + margin.bottom;
    const pane = this.createPane(container, paneWidth, bottom + margin.bottom);

    pane
      .append("path")
      .attr(
        "d",
        `M ${margin.bottom} 0 L ${paneWidth} 0 L ${paneWidth} ${bottom + margin.bottom} L 0 ${bottom + margin.bottom} L ${
          margin.bottom
        } ${bottom} Z`,
      )
      .attr("fill", "var(--color-bg-body)")
      .style("pointer-events", "auto");

    const group = pane.append("g").attr("transform", `translate(${margin.bottom},${margin.top})`).style("pointer-events", "auto");

    group.call(d3.axisRight(y)).selectAll("text").style("fill", "var(--color-text-primary)").style("font-size", `${axisFontSize}px`);

    this.removeDomains(group);

    group
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", margin.right - 20)
      .attr("x", 0 - height / 2)
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("fill", "var(--color-text-secondary)")
      .style("font-size", "12px")
      .text(label);

    return group;
  }

  /** Draws the horizontal gridlines aligned on the percentage scale. */
  public static renderGrid(scaffold: StackedBarScaffold): void {
    const yAxisGrid = d3
      .axisLeft(scaffold.y)
      .tickSize(-scaffold.width)
      .tickFormat(() => "")
      .ticks(10);

    scaffold.svg
      .append("g")
      .attr("class", "grid")
      .call(yAxisGrid)
      .selectAll("line")
      .style("stroke", "var(--color-border)")
      .style("stroke-opacity", "0.5")
      .style("shape-rendering", "crispEdges");

    scaffold.svg.selectAll(".domain").remove();
  }

  /**
   * Draws one group of stacked bars, coloured by category.
   * @param bandKey Reads the band label (student / question) from a stacked datum
   * @param options Visual and interaction differences of the calling view
   * @returns The layer groups, so the caller can add labels on top of the bars
   */
  public static renderLayers(
    scaffold: StackedBarScaffold,
    stackedData: d3.Series<any, string>[],
    visibleColors: Array<{ color: string }>,
    bandKey: (datum: any) => string,
    options: StackedBarRectOptions = {},
  ): d3.Selection<any, any, any, any> {
    const layers = scaffold.svg
      .selectAll("g.layer")
      .data(stackedData)
      .enter()
      .append("g")
      .classed("layer", true)
      .style("fill", (_datum, index) => visibleColors[index].color);

    const bars = layers
      .selectAll("rect")
      .data((series) => series)
      .enter()
      .append("rect")
      .attr("x", (datum: any) => scaffold.x(bandKey(datum)) ?? 0)
      .attr("y", (datum: any) => scaffold.y(datum[1]))
      .attr("height", (datum: any) => {
        const barHeight = scaffold.y(datum[0]) - scaffold.y(datum[1]);
        return isNaN(barHeight) ? 0 : barHeight;
      })
      .attr("width", scaffold.x.bandwidth())
      .style("transition", "opacity 0.2s");

    if (options.className) {
      bars.attr("class", options.className);
    }
    if (options.radius) {
      bars.attr("rx", options.radius).attr("ry", options.radius);
    }
    if (options.pointerEventsNone) {
      bars.style("pointer-events", "none");
    }
    if (options.cursor) {
      bars.style("cursor", options.cursor);
    }
    this.bindBarEvent(bars, "mouseover", options.onMouseOver);
    this.bindBarEvent(bars, "mousemove", options.onMouseMove);
    this.bindBarEvent(bars, "mouseout", options.onMouseOut);

    return layers;
  }

  /** Creates an axis pane (transparent to pointer events, except its slanted path). */
  private static createPane(container: HTMLElement, width: number, height: number): d3.Selection<any, any, any, any> {
    return d3
      .select(container)
      .append("svg")
      .style("display", "block")
      .attr("width", width)
      .attr("height", height)
      .style("pointer-events", "none");
  }

  /** Removes the axis domain lines and tick marks, for the flat look of both views. */
  private static removeDomains(selection: d3.Selection<any, any, any, any>): void {
    selection.selectAll(".domain").remove();
    selection.selectAll(".tick line").remove();
  }

  /** Wires an optional per-bar handler, preserving `this` as the bar rect. */
  private static bindBarEvent(
    bars: d3.Selection<SVGRectElement, any, any, any>,
    eventName: string,
    handler?: (event: MouseEvent, datum: any, rect: SVGRectElement) => void,
  ): void {
    if (!handler) {
      return;
    }
    bars.on(eventName, function (event: MouseEvent, datum: any) {
      handler(event, datum, this);
    });
  }
}
