import * as d3 from "d3";
import { TemplateRef } from "@angular/core";
import { Commit } from "@models/Commit.model";
import { Milestone } from "@models/Milestone.model";
import { Repository } from "@models/Repository.model";
import { Session } from "@models/Session.model";
import { AnonymizationService } from "@services/anonymization.service";
import { OverlayManagerService, OverlayType } from "@services/overlay-manager.service";
import { TooltipService } from "@services/tooltip.service";
import { Utils } from "@services/utils";

/**
 * Viewport of the commits graph: the absolute axis (repositories + dates), the d3 zoom behaviour
 * with its wheel plumbing, the shift-drag selection and the zoom helpers (reset, group, date range).
 *
 * Extracted from `CommitsComponent` (422 lines). `refresh()` — which orchestrates the whole graph —
 * deliberately stays in the component: it owns the delicate click/tooltip/dismissal wiring.
 */

/** View members the viewport needs from `CommitsComponent`. */
export interface ViewportHost {
  /* Échelles, axes et marges */
  x_scale: d3.ScaleTime<any, any, any>;
  x_scale_copy: d3.ScaleTime<any, any, any>;
  y_scale: d3.ScaleLinear<any, any, any>;
  x_axis: d3.Axis<Date | d3.NumberValue>;
  y_axis: d3.Axis<d3.NumberValue>;
  x_g: d3.Selection<SVGGElement, any, any, any>;
  y_g: d3.Selection<SVGGElement, any, any, any>;
  axis_g: d3.Selection<SVGGElement, any, any, any>;
  axis_abs_g: d3.Selection<any, any, any, any>;
  chart_abs_g: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  chart_selection_g: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  chart_svg: d3.Selection<any, any, any, any>;
  data_g: d3.Selection<any, any, any, any>;
  zoom: d3.ZoomBehavior<any, any>;
  current_zoom: any;
  last_zoom_k: number;
  zoomRafId: number | null;
  width: number;
  height: number;
  chart_width: number;
  inner_width: number;
  inner_height: number;
  inner_margin: any;
  scrollable_height: number;
  maxZoom: number;
  /* État d'interaction */
  drag: boolean;
  isShiftDragging: boolean;
  isSessionTooltipPinned: boolean;
  hovered_commit: Commit;
  hovered_group_commit: Commit[];
  hovered_session: Session;
  hovered_milestone: Milestone;
  hovered_repository: Repository;
  hovered_g: d3.Selection<any, any, any, any>;
  d3TooltipTemplate: TemplateRef<any>;
  /* Services et helpers du composant */
  tooltipService: TooltipService;
  overlayManagerService: OverlayManagerService;
  anonymizationService: AnonymizationService;
  ngZone: any;
  getRelativeXFromMouseEvent(event: MouseEvent): number;
  refreshElementState(): void;
  refreshTooltip(x?: number, y?: number): void;
  formatSelectionDuration(d1: Date, d2: Date): string;
}

export class ViewportRenderer {
  public static setupAxis(host: ViewportHost, repositories: Repository[], minDate: Date, maxDate: Date): any {
    if (host.axis_g != null) host.axis_g.remove();

    host.x_scale = d3.scaleTime().domain([minDate, maxDate]).range([0, host.inner_width]);

    if (host.current_zoom) {
      host.x_scale_copy = host.current_zoom.rescaleX(host.x_scale);
    } else {
      host.x_scale_copy = host.x_scale.copy();
    }
    host.last_zoom_k = host.current_zoom ? host.current_zoom.k : 1;

    host.x_axis = d3.axisBottom(host.x_scale_copy).ticks(6).tickSize(-host.inner_height);

    host.x_axis.tickFormat(function (d) {
      if (!(d instanceof Date)) return "";
      let ticks = host.x_scale_copy.ticks();
      if (ticks[ticks.length - 1] == null || ticks[0] == null) return "";
      let spacing = (ticks[ticks.length - 1].getTime() - ticks[0].getTime()) / 1000;

      return multiFormat(spacing, d);
    });

    host.axis_g = host.chart_svg.insert("g", ":first-child");
    host.axis_abs_g = host.chart_abs_g.insert("g", ":first-child");

    host.x_g = host.axis_abs_g
      .append("g")
      .attr("transform", "translate(" + [0, host.inner_height + host.inner_margin.top] + ")")
      .call(host.x_axis);

    host.y_scale = d3
      .scaleLinear()
      .domain([0, repositories.length + 1])
      .range([0, host.scrollable_height]);

    host.y_axis = d3
      .axisLeft(host.y_scale)
      .tickValues([...Array(repositories.length + 1).keys()])
      .tickFormat((d) => {
        const repo = repositories[d.valueOf() - 1];
        return repo ? host.anonymizationService.getDisplayName(repo) : "";
      })
      .tickSize(-host.inner_width);

    if (host.y_g != null) host.y_g.remove();
    host.y_g = host.axis_g.append("g").call(host.y_axis);

    // Hide the first tick use to prevent data from being placed on top of the chart
    host.y_g.select(".tick:first-of-type").attr("opacity", "0");

    // Set repo_name class, align to left, and use custom tooltip
    const leftSpace = host.width - host.chart_width;
    const leftX = -leftSpace + 5;

    host.y_g
      .selectAll(".tick")
      .selectAll("text")
      .call((g) => g.classed("repo_name", true))
      .attr("text-anchor", "start")
      .attr("x", leftX)
      .each(function (this: SVGTextElement) {
        let textStr = this.textContent || "";

        this.textContent = Utils.truncateMiddle(textStr, Utils.OVERVIEW_NAME_LENGTH_LIMIT);
      })
      .on("click", function (event: MouseEvent, d: any) {
        event.stopPropagation();
        if (host.anonymizationService.isAnonymous) {
          return;
        }
        const repo = repositories[d.valueOf() - 1];
        if (repo?.url) {
          window.open(repo.url, "_blank");
        }
      })
      .on("mouseenter", function (event: MouseEvent, d: any) {
        event.stopPropagation();
        const repo = repositories[d.valueOf() - 1];
        if (repo?.name) {
          host.ngZone.run(() => {
            host.hovered_repository = {
              ...repo,
              name: host.anonymizationService.getDisplayName(repo),
              url: host.anonymizationService.isAnonymous ? null : repo.url,
            } as Repository;
            host.hovered_commit = undefined;
            host.hovered_group_commit = undefined;
            host.hovered_session = undefined;
            host.hovered_milestone = undefined;
            host.tooltipService.showAtPosition(host.d3TooltipTemplate, event.clientX, event.clientY, "right", undefined, true);
          });
        }
      })
      .on("mousemove", function (event: MouseEvent) {
        event.stopPropagation();
        if (host.tooltipService.isShowing()) {
          host.tooltipService.moveTooltip(event.clientX, event.clientY, "right");
        }
      })
      .on("mouseleave", function (event: MouseEvent) {
        event.stopPropagation();
        host.ngZone.run(() => {
          host.hovered_repository = undefined;
          host.tooltipService.hide();
        });
      });

    // Use custom domain
    host.axis_abs_g.selectAll(".domain").style("opacity", "0");
    host.axis_g.selectAll(".domain").style("opacity", "0");

    host.axis_g
      .append("g")
      .attr("class", "axis")
      .append("line")
      .attr("x1", 0)
      .attr("x2", 0)
      .attr("y1", 0)
      .attr("y2", host.scrollable_height);

    host.axis_g
      .append("g")
      .attr("class", "axis")
      .append("line")
      .attr("x1", 0)
      .attr("x2", host.inner_width)
      .attr("y1", host.scrollable_height)
      .attr("y2", host.scrollable_height);
  }

  public static setupZoom(host: ViewportHost, conserveZoom: boolean = false): any {
    // This line may be removed if zoom is bugged. Used to somehow make zoom works on webkit based browsers.
    d3.select(document.body).on("wheel.body", () => {});
    host.zoom = d3
      .zoom()
      .interpolate((p0: [number, number, number], p1: [number, number, number]) => {
        const w0 = Math.max(1e-6, p0[2]),
          w1 = Math.max(1e-6, p1[2]);
        /* k est interpolé linéairement, et non géométriquement. La perception du zoom est
             proportionnelle à k alors que k géométrique ne l'est qu'en log(k) : sur un zoom guidé
             type (séance de 2 h dans un domaine d'un mois, k de 1 à 288) le zoom géométrique
             n'a fait que ~6 % de la taille finale à mi-parcours, alors que le déplacement est
             déjà à 50 %. D'où une animation en deux temps, "ça bouge puis ça zoome".
             En interpolant x et k tous deux linéairement, le point visé se déplace en ligne
             droite à l'écran ET change de taille au même rythme : les deux mouvements sont
             rigoureusement synchronisés, quel que soit le rapport de zoom. */
        const dx = p1[0] - p0[0],
          dy = p1[1] - p0[1],
          dw = w1 - w0;
        return (t: number) => [p0[0] + t * dx, p0[1] + t * dy, w0 + t * dw];
      })
      .on("start", (event) => {
        const hadChartHover =
          host.hovered_commit != null ||
          host.hovered_group_commit != null ||
          host.hovered_session != null ||
          host.hovered_milestone != null ||
          host.hovered_repository != null;

        host.hovered_commit = undefined;
        host.hovered_group_commit = undefined;
        host.hovered_g = null;
        /* Only dismiss the chart's own hover tooltip; leave a toolbar button
             tooltip alive so its keycap animation stays visible on shortcut use. */
        if (hadChartHover) {
          host.tooltipService.hide();
        }
        if (event.sourceEvent != null) {
          host.overlayManagerService.dismissAll({ blurInput: true });
        }
      })
      .on("zoom", (event) => {
        if (host.drag || !host.x_scale) {
          return;
        }

        if (event.sourceEvent != null) {
          host.overlayManagerService.dismissAll({ blurInput: true });
          host.refreshTooltip(event.sourceEvent.clientX, event.sourceEvent.clientY);
        }

        host.current_zoom = event.transform;
        host.x_scale_copy = host.current_zoom.rescaleX(host.x_scale);

        if (host.zoomRafId !== null) {
          return;
        }

        host.zoomRafId = requestAnimationFrame(() => {
          host.zoomRafId = null;
          host.x_g.call(host.x_axis.scale(host.x_scale_copy));
          host.refreshElementState();
        });
      })
      .on("end", () => {
        if (host.zoomRafId !== null) {
          cancelAnimationFrame(host.zoomRafId);
          host.zoomRafId = null;
        }
        host.x_g.call(host.x_axis.scale(host.x_scale_copy));
        host.refreshElementState();
      })
      .filter((event) => {
        if (event.type === "mousedown" && event.shiftKey) {
          return false;
        }
        return event.shiftKey || !(event instanceof WheelEvent);
      })
      .scaleExtent([0.5, host.maxZoom]);

    host.data_g = host.data_g.call(host.zoom).on("dblclick.zoom", null);

    d3.select(".chart-container").on("wheel", (event: WheelEvent) => ViewportRenderer.handleGraphWheel(host, event), { passive: false });

    if (conserveZoom) {
      ViewportRenderer.resetZoom(host, true);
    } else {
      ViewportRenderer.resetZoom(host, false);
    }
  }

  public static handleGraphWheel(host: ViewportHost, event: WheelEvent): any {
    // Zooming is handled by d3.zoom if shiftKey is pressed
    if (event.shiftKey) return;

    let dx = event.deltaX;
    let dy = event.deltaY;

    // Handle ctrl+wheel to scroll horizontally if the device only emits deltaY
    if (event.ctrlKey && Math.abs(dy) > 0 && Math.abs(dx) === 0) {
      dx = dy;
      dy = 0;
    }

    // If there is significant horizontal scrolling, or ctrl key is pressed
    if (Math.abs(dx) > Math.abs(dy) || event.ctrlKey) {
      host.overlayManagerService.dismissAll({ exclude: [OverlayType.SESSION_PANE] });
      event.preventDefault(); // Prevent browser back/forward or default scroll
      event.stopPropagation(); // Stop event bubbling to ensure Safari/Chrome doesn't catch it

      if (host.zoom && host.data_g) {
        // Pan horizontally
        host.data_g.call(host.zoom.translateBy, -dx / (host.current_zoom?.k || 1), 0);
      }
    }
  }

  public static handleNowWheel(host: ViewportHost, event: WheelEvent): any {
    if (event.shiftKey) {
      ViewportRenderer.forwardWheelToZoom(host, event);
      return;
    }

    const isHorizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.ctrlKey;
    if (isHorizontal) {
      ViewportRenderer.handleGraphWheel(host, event);
      return;
    }

    const container = document.querySelector(".chart-container") as HTMLElement;
    if (container) {
      container.scrollTop += event.deltaY;
      container.scrollLeft += event.deltaX;
      event.preventDefault();
    }
  }

  public static forwardWheelToZoom(host: ViewportHost, event: WheelEvent): any {
    const node = host.data_g && (host.data_g.node() as Element | null);
    if (!node) return;

    event.preventDefault();
    node.dispatchEvent(
      new WheelEvent("wheel", {
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        shiftKey: true,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        clientX: event.clientX,
        clientY: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY,
        bubbles: true,
        cancelable: true,
      }),
    );
  }

  public static zoomToDateRange(host: ViewportHost, startDate: Date, endDate: Date, marginRatio = 0.05, dismissOverlays = true): any {
    if (!startDate || !endDate || !host.data_g || !host.zoom || !host.x_scale) return;
    host.hovered_commit = undefined;
    host.hovered_group_commit = undefined;
    host.hovered_session = undefined;
    host.hovered_milestone = undefined;
    host.hovered_repository = undefined;
    host.hovered_g = null;
    host.isSessionTooltipPinned = false;
    if (dismissOverlays) {
      host.tooltipService.hide();
      host.overlayManagerService.dismissAll();
    }

    const time_domain = host.x_scale.domain();
    const minDate = time_domain[0].valueOf() as number;
    const maxDate = time_domain[1].valueOf() as number;
    const dt = maxDate - minDate;

    const t1 = startDate.getTime();
    const t2 = endDate.getTime();
    const selectedDuration = Math.max(1000, Math.abs(t2 - t1));

    if (isNaN(minDate) || isNaN(maxDate) || isNaN(t1) || isNaN(t2) || dt <= 0) return;

    const minSelected = Math.min(t1, t2);
    const maxSelected = Math.max(t1, t2);
    const margin = selectedDuration * marginRatio;

    const targetStart = minSelected - margin;
    const targetEnd = maxSelected + margin;
    const targetDuration = targetEnd - targetStart;

    let target_k = dt / targetDuration;
    target_k = Math.max(1, Math.min(target_k, host.maxZoom));

    const translate_x = -((targetStart - minDate) / dt) * host.inner_width * target_k;

    const transform = d3.zoomIdentity.translate(translate_x, 0).scale(target_k);

    /* Animation réactive fluide : décélération cubic-bezier(0.23, 1, 0.32, 1) en 480ms */
    host.data_g.transition().duration(480).ease(d3.easeCubicOut).call(host.zoom.transform, transform);
  }

  public static initiateShiftDragZoom(host: ViewportHost, event: MouseEvent): any {
    if (event.button !== 0 || !event.shiftKey || !host.chart_selection_g || !host.x_scale_copy) return;
    event.preventDefault();
    event.stopPropagation();
    host.overlayManagerService.dismissAll();

    const startX = host.getRelativeXFromMouseEvent(event);
    const clampedStartX = Math.max(0, Math.min(host.inner_width, startX));

    const selectionGroup = host.chart_selection_g.append("g").attr("class", "chart-selection-group").style("pointer-events", "none");

    const selectionBg = selectionGroup
      .append("rect")
      .attr("class", "chart-selection-bg")
      .attr("x", clampedStartX)
      .attr("y", 0)
      .attr("width", 0)
      .attr("height", host.height);

    const leftLine = selectionGroup
      .append("line")
      .attr("class", "chart-selection-edge chart-selection-edge-left")
      .attr("x1", clampedStartX)
      .attr("y1", 0)
      .attr("x2", clampedStartX)
      .attr("y2", host.height);

    const rightLine = selectionGroup
      .append("line")
      .attr("class", "chart-selection-edge chart-selection-edge-right")
      .attr("x1", clampedStartX)
      .attr("y1", 0)
      .attr("x2", clampedStartX)
      .attr("y2", host.height);

    const topBar = selectionGroup
      .append("rect")
      .attr("class", "chart-selection-top-bar")
      .attr("x", clampedStartX)
      .attr("y", 0)
      .attr("width", 0)
      .attr("height", 2.5)
      .attr("rx", 1.25)
      .attr("ry", 1.25);

    const badge = selectionGroup.append("g").attr("class", "chart-selection-badge").style("opacity", "0");

    const badgeBg = badge.append("rect").attr("class", "chart-selection-badge-bg").attr("height", 20).attr("rx", 10).attr("ry", 10);

    const badgeText = badge.append("text").attr("class", "chart-selection-badge-text").attr("y", 14).attr("text-anchor", "middle");

    document.body.style.cursor = "crosshair";
    host.isShiftDragging = true;
    let hasMovedEnough = false;

    const onWindowMouseMove = (e: MouseEvent) => {
      const currentX = host.getRelativeXFromMouseEvent(e);
      const minX = Math.max(0, Math.min(clampedStartX, currentX));
      const maxX = Math.min(host.inner_width, Math.max(clampedStartX, currentX));
      const w = Math.max(0, maxX - minX);

      if (Math.abs(currentX - clampedStartX) >= 8) {
        hasMovedEnough = true;
      }

      selectionBg.attr("x", minX).attr("width", w);
      leftLine.attr("x1", minX).attr("x2", minX);
      rightLine.attr("x1", maxX).attr("x2", maxX);
      topBar.attr("x", minX).attr("width", w);

      if (w >= 16 && host.x_scale_copy) {
        const d1 = host.x_scale_copy.invert(minX);
        const d2 = host.x_scale_copy.invert(maxX);
        const durText = host.formatSelectionDuration(d1, d2);
        badgeText.text(durText);

        const textNode = badgeText.node() as SVGTextContentElement;
        const textWidth = textNode ? textNode.getComputedTextLength() : durText.length * 6.5;
        const badgeWidth = Math.max(50, textWidth + 16);

        badgeBg.attr("width", badgeWidth).attr("x", -badgeWidth / 2);

        let badgeX = minX + w / 2;
        badgeX = Math.max(badgeWidth / 2 + 6, Math.min(host.inner_width - badgeWidth / 2 - 6, badgeX));
        const badgeY = Math.max(6, host.inner_margin?.top ? host.inner_margin.top + 8 : 12);

        badge.attr("transform", `translate(${badgeX}, ${badgeY})`).style("opacity", "1");
      } else {
        badge.style("opacity", "0");
      }
    };

    const onWindowMouseUp = (e: MouseEvent) => {
      window.removeEventListener("mousemove", onWindowMouseMove);
      window.removeEventListener("mouseup", onWindowMouseUp);
      document.body.style.cursor = "";
      host.isShiftDragging = false;

      const currentX = host.getRelativeXFromMouseEvent(e);
      const distance = Math.abs(currentX - clampedStartX);

      if (distance >= 8 && hasMovedEnough) {
        selectionGroup.classed("selection-exiting", true);
        setTimeout(() => selectionGroup.remove(), 180);

        const minX = Math.max(0, Math.min(clampedStartX, currentX));
        const maxX = Math.min(host.inner_width, Math.max(clampedStartX, currentX));
        const d1 = host.x_scale_copy.invert(minX);
        const d2 = host.x_scale_copy.invert(maxX);
        ViewportRenderer.zoomToDateRange(host, d1, d2, 0.05);
      } else {
        selectionGroup.remove();
      }
    };

    window.addEventListener("mousemove", onWindowMouseMove);
    window.addEventListener("mouseup", onWindowMouseUp);
  }

  public static resetZoom(host: ViewportHost, conserve?: boolean, dismissOverlays = true): any {
    if (conserve) {
      if (host.current_zoom) {
        host.data_g.call(host.zoom.transform, host.current_zoom);
      } else {
        host.data_g.call(host.zoom.transform, d3.zoomIdentity.translate(0, 0).scale(1));
      }
      return;
    }

    host.current_zoom = null;
    if (dismissOverlays) {
      host.overlayManagerService.dismissTransient();
    }
    if (host.data_g && host.zoom) {
      host.data_g.transition().duration(750).call(host.zoom.transform, d3.zoomIdentity.translate(0, 0).scale(1));
    }
  }

  public static zoomToGroup(host: ViewportHost, commits: Commit[], range: number): any {
    if (!commits || commits.length < 2 || range <= 0) return;
    host.hovered_commit = undefined;
    host.hovered_group_commit = undefined;
    host.hovered_g = null;
    host.tooltipService.hide();
    host.overlayManagerService.dismissAll();

    let time_domain = host.x_scale.domain();
    let minDate = time_domain[0].valueOf() as number;
    let maxDate = time_domain[1].valueOf() as number;
    let dt = maxDate - minDate;

    let target_k = ((Utils.COMMIT_FUSE_RANGE + 5) * dt) / (range * host.inner_width);
    target_k = Math.min(target_k, host.maxZoom);

    let centerTime = (commits[0].commitDate.getTime() + commits[commits.length - 1].commitDate.getTime()) / 2;
    let translate_x = host.inner_width / 2 - ((centerTime - minDate) / dt) * host.inner_width * target_k;

    let transform = d3.zoomIdentity.translate(translate_x, 0).scale(target_k);

    host.data_g.transition().duration(750).call(host.zoom.transform, transform);
  }
}

/**
 * Format of the absolute axis ticks: switches between year, month, day, hour and minute labels
 * depending on the spacing between two ticks (moved from `CommitsComponent.multiFormat`).
 */
export function multiFormat(spacing: number, date: Date): string {
  const options: Intl.NumberFormatOptions = {
    useGrouping: false,
    minimumIntegerDigits: 2,
  };

  if (spacing > 24 * 3600)
    return `${date.getDate().toLocaleString(undefined, options)}/${(date.getMonth() + 1).toLocaleString(undefined, options)}/${date
      .getFullYear()
      .toLocaleString(undefined, options)}`;
  else return `${date.getHours().toLocaleString(undefined, options)}:${date.getMinutes().toLocaleString(undefined, options)}`;
}
