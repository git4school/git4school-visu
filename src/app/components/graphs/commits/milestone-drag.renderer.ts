import * as d3 from "d3";
import { Milestone } from "@models/Milestone.model";
import { OverlayManagerService } from "@services/overlay-manager.service";
import { TooltipService } from "@services/tooltip.service";
import { formatCommitDay, formatCommitHour } from "./commits-format.util";

/**
 * Milestone drag: follows the pointer, shows the date under the cursor, auto-scrolls near the edges
 * and saves the moved milestone on release.
 *
 * Extracted from `CommitsComponent` (141 lines, no event wiring: the listeners stay in
 * `setupMilestoneInteractions`, which calls the three public entry points below).
 */

/** View members the milestone drag needs from `CommitsComponent`. */
export interface MilestoneDragHost {
  /* Couches et échelles */
  data_g: d3.Selection<any, any, any, any>;
  chart_abs_g: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  axis_abs_g: d3.Selection<any, any, any, any>;
  x_scale_copy: d3.ScaleTime<any, any, any>;
  zoom: d3.ZoomBehavior<any, any>;
  current_zoom: any;
  width: number;
  chart_width: number;
  inner_width: number;
  inner_height: number;
  inner_margin: any;
  /* État du drag */
  isDraggingMilestone: boolean;
  hasMovedDuringDrag: boolean;
  hovered_milestone: Milestone;
  dragTimeIndicator: d3.Selection<any, any, any, any>;
  dragScrollTimer: d3.Timer;
  /* Services et helpers du composant */
  overlayManagerService: OverlayManagerService;
  tooltipService: TooltipService;
  xScaledTimeZoned(date: Date | string): number;
  clearMilestoneHoverTimer(): void;
  updateAfterMilestoneChange(): void;
  updateMilestoneCutoutMask(): void;
}

export class MilestoneDragRenderer {
  /** Démarre un drag de jalon : affiche l'indicateur de date et fige l'axe des x. */
  public static start(host: MilestoneDragHost, startX: number, element: d3.Selection<any, any, any, any>, m?: Milestone): void {
    host.overlayManagerService.dismissTransient();
    host.isDraggingMilestone = true;
    host.hasMovedDuringDrag = false;
    host.clearMilestoneHoverTimer();
    if (host.hovered_milestone) {
      host.hovered_milestone = undefined;
      host.tooltipService.hide();
    }
    element.raise();
    element.select(".hitbox").attr("style", "cursor: grabbing; pointer-events: all;");
    MilestoneDragRenderer.createIndicator(host, startX);
    if (m) {
      MilestoneDragRenderer.updateIndicator(host, startX, m.date);
    }
  }

  /** Suit le pointeur pendant un drag (indicateur de date + défilement de bord). */
  public static update(host: MilestoneDragHost, event: MouseEvent, element: d3.Selection<any, any, any, any>, m: Milestone): void {
    host.hasMovedDuringDrag = true;
    let currentX = 0;
    if (host.chart_abs_g) {
      const [px] = (d3 as any).pointer(event, host.chart_abs_g.node());
      currentX = px;
    } else {
      currentX = event.clientX;
    }
    currentX = Math.max(0, Math.min(host.inner_width, currentX));

    m.date = host.x_scale_copy.invert(currentX);
    element.attr("transform", `translate(${currentX}, ${host.inner_margin.top})`);

    MilestoneDragRenderer.updateIndicator(host, currentX, m.date);
    host.updateMilestoneCutoutMask();
    MilestoneDragRenderer.handleEdgeScrolling(host, currentX, element, m);
  }

  /** Termine un drag : masque l'indicateur, arrête le défilement et sauvegarde si déplacé. */
  public static end(host: MilestoneDragHost, element: d3.Selection<any, any, any, any>, hasMoved: boolean): void {
    host.isDraggingMilestone = false;
    document.body.style.cursor = "";
    element.select(".hitbox").attr("style", "cursor: pointer; pointer-events: all;");

    MilestoneDragRenderer.stopScrollTimer(host);
    MilestoneDragRenderer.removeIndicator(host);

    if (hasMoved) {
      host.updateAfterMilestoneChange();
    }
  }

  /** Arrête le minuteur de défilement automatique (appelé aussi à la destruction). */
  public static stopScrollTimer(host: MilestoneDragHost): void {
    if (host.dragScrollTimer) {
      host.dragScrollTimer.stop();
      host.dragScrollTimer = null;
    }
  }

  /** Supprime l'indicateur de date (appelé aussi à la destruction du composant). */
  public static removeIndicator(host: MilestoneDragHost): void {
    if (host.dragTimeIndicator) {
      host.dragTimeIndicator.remove();
      host.dragTimeIndicator = null;
    }
  }

  /** Crée l'indicateur de date affiché pendant un drag. */
  private static createIndicator(host: MilestoneDragHost, x: number): void {
    if (!host.axis_abs_g) return;

    host.dragTimeIndicator = host.axis_abs_g
      .append("g")
      .attr("class", "drag-time-indicator")
      .attr("transform", `translate(${x}, ${host.inner_height + host.inner_margin.top})`);

    // Triangle pointer
    host.dragTimeIndicator
      .append("path")
      .attr("class", "indicator-pointer")
      .attr("d", "M -6 5 L 6 5 L 0 -1 Z")
      .attr("fill", "var(--color-surface)")
      .attr("stroke", "var(--color-border)")
      .attr("stroke-width", "1px");

    // Pill background
    host.dragTimeIndicator
      .append("rect")
      .attr("class", "pill-bg")
      .attr("x", -50)
      .attr("y", 4)
      .attr("width", 100)
      .attr("height", 24)
      .attr("rx", 12)
      .style("fill", "var(--color-surface)")
      .style("stroke", "var(--color-border)")
      .style("stroke-width", "1px")
      .style("filter", "var(--badge-drag-shadow)");

    host.dragTimeIndicator
      .append("text")
      .attr("x", 0)
      .attr("y", 16)
      .attr("dominant-baseline", "central")
      .attr("text-anchor", "middle")
      .style("fill", "var(--color-text-primary)")
      .style("font-size", "11px")
      .style("font-weight", "600")
      .style("pointer-events", "none");
  }

  /** Positionne l'indicateur de date à l'abscisse courante. */
  private static updateIndicator(host: MilestoneDragHost, x: number, date: Date): void {
    if (!host.dragTimeIndicator) return;

    host.dragTimeIndicator.attr("transform", `translate(${x}, ${host.inner_height + host.inner_margin.top})`);

    const timeString = `${formatCommitDay(date)} ${formatCommitHour(date)}`;
    const textEl = host.dragTimeIndicator.select("text");
    textEl.text(timeString);

    // Dynamically adjust the pill width and clamp position to prevent clipping
    const textNode = textEl.node() as SVGTextElement;
    if (textNode) {
      const bbox = textNode.getBBox();
      const padding = 20; // 10px padding on each side
      const width = Math.max(80, bbox.width + padding); // minimum width

      let pillX = -width / 2;
      const leftMargin = host.width - host.chart_width;

      if (x + pillX + width > host.inner_width) {
        pillX = host.inner_width - x - width;
      }
      if (x + pillX < -leftMargin) {
        pillX = -leftMargin - x;
      }

      host.dragTimeIndicator.select(".pill-bg").attr("width", width).attr("x", pillX);

      textEl.attr("x", pillX + width / 2);
    }
  }

  /** Défile automatiquement quand le pointeur approche d'un bord du graphe. */
  private static handleEdgeScrolling(
    host: MilestoneDragHost,
    currentX: number,
    element: d3.Selection<any, any, any, any>,
    m: Milestone,
  ): void {
    const scrollMargin = 50;
    const scrollSpeed = 5;
    let dx = 0;

    if (currentX < scrollMargin) {
      dx = scrollSpeed;
    } else if (currentX > host.inner_width - scrollMargin) {
      dx = -scrollSpeed;
    }

    if (dx !== 0) {
      if (!host.dragScrollTimer) {
        host.dragScrollTimer = d3.timer(() => MilestoneDragRenderer.performScroll(host, dx, element, m));
      }
    } else {
      MilestoneDragRenderer.stopScrollTimer(host);
    }
  }

  /** Un pas de défilement automatique pendant un drag. */
  private static performScroll(host: MilestoneDragHost, dx: number, element: d3.Selection<any, any, any, any>, m: Milestone): void {
    if (!host.zoom || !host.data_g) return;

    host.data_g.call(host.zoom.translateBy, dx / (host.current_zoom?.k || 1), 0);

    let updatedX = host.xScaledTimeZoned(m.date);
    updatedX = Math.max(0, Math.min(host.inner_width, updatedX));
    element.attr("transform", `translate(${updatedX}, ${host.inner_margin.top})`);

    MilestoneDragRenderer.updateIndicator(host, updatedX, m.date);
  }
}
