/* PROTOTYPE — renders the "now" indicator variants (A / G) into the commits
 * graph. Dev-only, removed once a variant is chosen.
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
  private static readonly HITBOX_HALF_WIDTH = 10;

  static render(host: d3.Selection<any, any, any, any>, variant: NowIndicatorVariant, ctx: NowIndicatorPrototypeContext): void {
    if (!host || host.empty()) {
      return;
    }

    host.selectAll("*").remove();
    host.classed("proto-now-hover", false);
    host.style("display", null).attr("transform", `translate(${ctx.x}, ${ctx.top})`);

    switch (variant) {
      case "A":
        this.renderCursorLine(host, ctx);
        break;
      case "G":
        this.renderAxisFlag(host, ctx);
        break;
      default:
        host.style("display", "none");
    }
  }

  /** A — dotted reference line; hovering reveals a pill that follows the cursor. */
  private static renderCursorLine(host: d3.Selection<any, any, any, any>, ctx: NowIndicatorPrototypeContext): void {
    host.append("line").attr("class", "proto-now-line").attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", ctx.plotHeight);

    const pill = host.append("g").attr("class", "proto-now-pill");
    const content = pill.append("g").attr("class", "proto-now-pill-content");

    const text = content
      .append("text")
      .attr("class", "proto-now-pill-text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .text(ctx.labelText);

    const height = 18;
    let width = Math.max(64, ctx.labelText.length * 5.6 + 18);
    const node = text.node() as SVGTextElement;
    if (node && typeof node.getBBox === "function") {
      const measured = node.getBBox().width;
      if (measured > 0) {
        width = Math.max(64, measured + 18);
      }
    }

    /* Keep the pill inside the plot when the line sits near the right edge. */
    let centerX = 0;
    if (ctx.x + width / 2 > ctx.innerWidth) {
      centerX = ctx.innerWidth - ctx.x - width / 2;
    }

    content
      .insert("rect", "text")
      .attr("class", "proto-now-pill-bg")
      .attr("x", centerX - width / 2)
      .attr("y", -height / 2)
      .attr("width", width)
      .attr("height", height)
      .attr("rx", height / 2)
      .attr("ry", height / 2);

    text.attr("x", centerX).attr("y", 0);

    const follow = (event: MouseEvent) => {
      const [, py] = d3.pointer(event, host.node());
      pill.attr("transform", `translate(0, ${py})`);
    };

    host
      .append("rect")
      .attr("class", "proto-now-hitbox proto-now-hitbox-line")
      .attr("x", -this.HITBOX_HALF_WIDTH)
      .attr("y", 0)
      .attr("width", this.HITBOX_HALF_WIDTH * 2)
      .attr("height", ctx.plotHeight)
      .on("mouseenter", (event: MouseEvent) => {
        follow(event);
        host.classed("proto-now-hover", true);
      })
      .on("mousemove", (event: MouseEvent) => {
        follow(event);
      })
      .on("mouseleave", () => {
        host.classed("proto-now-hover", false);
      });
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
      .attr("class", "proto-now-hitbox proto-now-hitbox-flag")
      .attr("x", -10)
      .attr("y", ctx.plotHeight - 16)
      .attr("width", 20)
      .attr("height", 18);
  }
}
