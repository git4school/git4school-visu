/* PROTOTYPE — renders the three "now" indicator variants (A / F / G) into the
 * commits graph. Dev-only, removed once a variant is chosen.
 * See AGENTS.md §1 "Prototypes". */
import * as d3 from "d3";
import { NowIndicatorVariant } from "./now-indicator-prototype.service";

export interface NowIndicatorPrototypeContext {
  x: number;
  innerWidth: number;
  plotHeight: number;
  top: number;
  labelText: string;
}

export class NowIndicatorPrototypeRenderer {
  static render(host: d3.Selection<any, any, any, any>, variant: NowIndicatorVariant, ctx: NowIndicatorPrototypeContext): void {
    if (!host || host.empty()) {
      return;
    }

    host.selectAll("*").remove();
    host.style("display", null).attr("transform", `translate(${ctx.x}, ${ctx.top})`);

    switch (variant) {
      case "A":
        this.renderGhostLine(host, ctx);
        break;
      case "F":
        this.renderFutureBand(host, ctx);
        break;
      case "G":
        this.renderAxisFlag(host, ctx);
        break;
      default:
        host.style("display", "none");
    }
  }

  /** A — faint dashed line across the plot + a dot on the x-axis; time on hover. */
  private static renderGhostLine(host: d3.Selection<any, any, any, any>, ctx: NowIndicatorPrototypeContext): void {
    host.append("line").attr("class", "proto-now-line").attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", ctx.plotHeight);

    host.append("circle").attr("class", "proto-now-dot").attr("cx", 0).attr("cy", ctx.plotHeight).attr("r", 3.5);

    this.appendHoverLabel(host, ctx);
    this.appendHitbox(host, ctx);
  }

  /** F — dimmed "future" band from now to the right edge; no label. */
  private static renderFutureBand(host: d3.Selection<any, any, any, any>, ctx: NowIndicatorPrototypeContext): void {
    const width = Math.max(0, ctx.innerWidth - ctx.x);

    host.append("rect").attr("class", "proto-now-band").attr("x", 0).attr("y", 0).attr("width", width).attr("height", ctx.plotHeight);

    host.append("line").attr("class", "proto-now-band-edge").attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", ctx.plotHeight);
  }

  /** G — small tick + triangle on the x-axis; time on hover. */
  private static renderAxisFlag(host: d3.Selection<any, any, any, any>, ctx: NowIndicatorPrototypeContext): void {
    const y = ctx.plotHeight;

    host
      .append("line")
      .attr("class", "proto-now-tick")
      .attr("x1", 0)
      .attr("x2", 0)
      .attr("y1", y - 7)
      .attr("y2", y);
    host
      .append("path")
      .attr("class", "proto-now-flag")
      .attr("d", `M -4 ${y - 7} L 4 ${y - 7} L 0 ${y} Z`);

    this.appendHoverLabel(host, ctx);
    this.appendHitbox(host, ctx);
  }

  private static appendHoverLabel(host: d3.Selection<any, any, any, any>, ctx: NowIndicatorPrototypeContext): void {
    const height = 16;
    const label = host.append("g").attr("class", "proto-now-label");

    const text = label
      .append("text")
      .attr("class", "proto-now-label-text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .text(ctx.labelText);

    let labelWidth = Math.max(56, ctx.labelText.length * 5.6 + 14);
    const node = text.node() as SVGTextElement;
    if (node && typeof node.getBBox === "function") {
      const measured = node.getBBox().width;
      if (measured > 0) {
        labelWidth = Math.max(56, measured + 14);
      }
    }

    let pillX = -labelWidth / 2;
    if (ctx.x + pillX + labelWidth > ctx.innerWidth) {
      pillX = ctx.innerWidth - ctx.x - labelWidth;
    }
    if (ctx.x + pillX < 0) {
      pillX = -ctx.x;
    }

    const bgY = ctx.plotHeight - height - 10;

    label
      .insert("rect", "text")
      .attr("class", "proto-now-label-bg")
      .attr("x", pillX)
      .attr("y", bgY)
      .attr("width", labelWidth)
      .attr("height", height)
      .attr("rx", height / 2)
      .attr("ry", height / 2);

    text.attr("x", pillX + labelWidth / 2).attr("y", bgY + height / 2);
  }

  private static appendHitbox(host: d3.Selection<any, any, any, any>, ctx: NowIndicatorPrototypeContext): void {
    host
      .append("rect")
      .attr("class", "proto-now-hitbox")
      .attr("x", -10)
      .attr("y", ctx.plotHeight - 16)
      .attr("width", 20)
      .attr("height", 18);
  }
}
