import * as d3 from "d3";
import { Milestone } from "@models/Milestone.model";

/**
 * Cutout masks of the milestone labels: a label is masked wherever a newer milestone overlaps it
 * (SVG painter order), so two overlapping milestones never stack their text.
 *
 * Extracted from `CommitsComponent` (169 lines of pure mask geometry, no event wiring).
 */

/** View members the milestone masks need from `CommitsComponent`. */
export interface MilestoneMaskHost {
  /** Absolute chart layer (the masks live in its `defs`). */
  svg_abs: d3.Selection<any, unknown, HTMLElement, any>;
  /** Group holding every milestone of the absolute layer. */
  milestones_g: d3.Selection<any, any, any, any>;
  chart_abs_g: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  width: number;
  xScaledTimeZoned(date: Date | string): number;
}

/** Bounds of a visible milestone, used to compute the overlaps. */
interface VisibleMilestoneItem {
  element: d3.Selection<SVGGElement, Milestone, any, any>;
  labelGroup: d3.Selection<SVGGElement, any, any, any>;
  milestone: Milestone;
  x: number;
  width: number;
  date: Date;
  time: number;
}

export class MilestoneMaskRenderer {
  /** Rebuilds the cutout masks of every visible milestone label. */
  public static update(host: MilestoneMaskHost): void {
    if (!host.svg_abs) return;

    let defs = host.svg_abs.select("defs");
    if (defs.empty()) {
      defs = host.svg_abs.append("defs");
    }

    // 1. Maintain chronological DOM order (oldest first, newest last = on top in SVG painter model)
    if (host.milestones_g) {
      host.milestones_g.selectAll(".milestone").sort((a: Milestone, b: Milestone) => {
        const tA = new Date(a.date).getTime();
        const tB = new Date(b.date).getTime();
        if (tA !== tB) return tA - tB;
        return (a.label || "").localeCompare(b.label || "");
      });
    }

    // 2. Collect visible milestones and their geometric bounds
    interface VisibleMilestoneItem {
      element: d3.Selection<SVGGElement, Milestone, any, any>;
      labelGroup: d3.Selection<SVGGElement, any, any, any>;
      milestone: Milestone;
      x: number;
      width: number;
      date: Date;
      time: number;
    }

    const visibleItems: VisibleMilestoneItem[] = [];
    const overview = this;

    if (host.chart_abs_g) {
      host.chart_abs_g.selectAll(".milestone").each(function (m: Milestone) {
        const el = d3.select(this) as d3.Selection<SVGGElement, Milestone, any, any>;
        if (el.classed("hidden")) return;
        const x = host.xScaledTimeZoned(m.date);
        if (x < -100 || x > host.width + 100) return;

        const bar = el.select(".milestone-bottom-bar");
        let width = 50;
        if (!bar.empty()) {
          const barW = parseFloat(bar.attr("width") || "50");
          if (!isNaN(barW) && barW > 0) {
            width = barW;
          }
        }
        visibleItems.push({
          element: el,
          labelGroup: el.select(".milestone-label-group"),
          milestone: m,
          x,
          width,
          date: new Date(m.date),
          time: new Date(m.date).getTime(),
        });
      });
    }

    // Sort chronologically ascending
    visibleItems.sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      return (a.milestone.label || "").localeCompare(b.milestone.label || "");
    });

    // 3. Update Session Badges Cutout Mask (#milestone-badges-cutout-mask)
    let sessionMask = defs.select("#milestone-badges-cutout-mask");
    if (sessionMask.empty()) {
      sessionMask = defs
        .append("mask")
        .attr("id", "milestone-badges-cutout-mask")
        .attr("maskUnits", "userSpaceOnUse")
        .attr("x", "0")
        .attr("y", "0")
        .attr("width", "100%")
        .attr("height", "100%");

      sessionMask.append("rect").attr("x", -5000).attr("y", 0).attr("width", 100000).attr("height", 100).attr("fill", "white");

      sessionMask.append("g").attr("id", "milestone-mask-cutouts");
    }

    const sessionMaskCutoutsGroup = sessionMask.select("#milestone-mask-cutouts");
    if (!sessionMaskCutoutsGroup.empty()) {
      // With double-rail layout, session headers and milestone labels do not overlap
      const sessionCutouts: { x: number; width: number }[] = [];

      const sRects = sessionMaskCutoutsGroup.selectAll("rect").data(sessionCutouts);
      sRects.exit().remove();
      sRects
        .enter()
        .append("rect")
        .merge(sRects as any)
        .attr("x", (d) => d.x)
        .attr("y", 0)
        .attr("width", (d) => d.width)
        .attr("height", 28)
        .attr("rx", 1.5)
        .attr("ry", 1.5)
        .attr("fill", "black");
    }

    // 4. Milestone-to-Milestone Overlap Cutouts (#milestone-overlap-defs)
    let overlapDefs = defs.select("#milestone-overlap-defs");
    if (overlapDefs.empty()) {
      overlapDefs = defs.append("g").attr("id", "milestone-overlap-defs");
    }

    const overlapPadding = 0; // Cutout matches exact trait width, no further
    const usedMaskIds = new Set<string>();

    visibleItems.forEach((current, i) => {
      const currentHalfWidth = current.width / 2;
      const currentLeft = current.x - currentHalfWidth;
      const currentRight = current.x + currentHalfWidth;

      const cutoutsForCurrent: { relX: number; cutWidth: number }[] = [];

      // Check all NEWER milestones (j > i) that overlap with this milestone's horizontal span
      for (let j = i + 1; j < visibleItems.length; j++) {
        const newer = visibleItems[j];
        const newerHalfCutWidth = newer.width / 2 + overlapPadding;
        const newerLeft = newer.x - newerHalfCutWidth;
        const newerRight = newer.x + newerHalfCutWidth;

        // Check if horizontal intervals overlap
        if (currentRight >= newerLeft && currentLeft <= newerRight) {
          // Overlap detected! In current milestone's local coordinate system:
          const relX = newer.x - current.x - newerHalfCutWidth;
          cutoutsForCurrent.push({
            relX,
            cutWidth: newer.width + overlapPadding * 2,
          });
        }
      }

      if (cutoutsForCurrent.length === 0) {
        // No overlap with any newer milestone: remove mask
        current.labelGroup.attr("mask", null);
      } else {
        // Apply cutout mask to erase the area under newer milestones
        const maskId = `milestone-overlap-mask-${i}`;
        usedMaskIds.add(maskId);

        let oMask = overlapDefs.select(`#${maskId}`);
        if (oMask.empty()) {
          oMask = overlapDefs
            .append("mask")
            .attr("id", maskId)
            .attr("maskUnits", "userSpaceOnUse")
            .attr("x", "-5000")
            .attr("y", "-100")
            .attr("width", "10000")
            .attr("height", "200");

          oMask
            .append("rect")
            .attr("class", "mask-base")
            .attr("x", -5000)
            .attr("y", -100)
            .attr("width", 10000)
            .attr("height", 200)
            .attr("fill", "white");

          oMask.append("g").attr("class", "mask-cuts");
        }

        const cutsGroup = oMask.select(".mask-cuts");
        const cutRects = cutsGroup.selectAll("rect").data(cutoutsForCurrent);
        cutRects.exit().remove();
        cutRects
          .enter()
          .append("rect")
          .merge(cutRects as any)
          .attr("x", (d) => d.relX)
          .attr("y", -30)
          .attr("width", (d) => d.cutWidth)
          .attr("height", 30)
          .attr("rx", 1.5)
          .attr("ry", 1.5)
          .attr("fill", "black");

        current.labelGroup.attr("mask", `url(#${maskId})`);
      }
    });

    // Clean up unused overlap masks
    overlapDefs.selectAll("mask").each(function () {
      const id = d3.select(this).attr("id");
      if (id && !usedMaskIds.has(id)) {
        d3.select(this).remove();
      }
    });
  }
}
