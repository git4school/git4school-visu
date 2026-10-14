import * as d3 from "d3";
import { TemplateRef } from "@angular/core";
import { Commit } from "@models/Commit.model";
import { Milestone } from "@models/Milestone.model";
import { Repository } from "@models/Repository.model";
import { Session } from "@models/Session.model";
import { ClockService } from "@services/clock.service";
import { DataService } from "@services/data.service";
import { TooltipService } from "@services/tooltip.service";

/**
 * Points of the commits graph: the commit rows themselves (`loadPoints`) and the milestone layer
 * (graphics + long-press/drag/click interactions).
 *
 * Extracted from `CommitsComponent` (247 lines). The tooltip hub (`refreshTooltip`) stays in the
 * component, which owns the hover state shared by every layer.
 */

/** View members the commit points and milestones need from `CommitsComponent`. */
export interface GraphPointsHost {
  /* Couches et échelles */
  data_g: d3.Selection<any, any, any, any>;
  axis_g: d3.Selection<SVGGElement, any, any, any>;
  repository_g: d3.Selection<any, any, any, any>;
  repositories_g: d3.Selection<any, Repository, any, any>[];
  y_scale: d3.ScaleLinear<any, any, any>;
  inner_height: number;
  inner_margin: any;
  maxZoom: number;
  /* Données filtrées */
  filteredCommitsCount: number;
  filteredStudentsCount: number;
  dataService: DataService;
  clockService: ClockService;
  getDisplayedRepositories(): Repository[];
  isCommitMatchingFilter(commit: Commit): boolean;
  /* État de survol et d'interaction */
  hovered_commit: Commit;
  hovered_group_commit: Commit[];
  hovered_milestone: Milestone;
  hovered_session: Session;
  hovered_repository: Repository;
  hovered_g: d3.Selection<any, any, any, any>;
  isSessionTooltipPinned: boolean;
  isDraggingMilestone: boolean;
  ignoreNextMilestoneClick: boolean;
  activeMilestoneBadge: d3.Selection<any, any, any, any>;
  activeMilestoneCleanupFn: (() => void) | null;
  milestoneLongPressTimer: any;
  readonly MILESTONE_HOLD_DURATION: number;
  readonly MILESTONE_DRAG_JITTER_TOLERANCE: number;
  readonly MILESTONE_CLICK_SUPPRESSION_DELAY: number;
  /* Services et helpers */
  tooltipService: TooltipService;
  ngZone: any;
  d3TooltipTemplate: TemplateRef<any>;
  xScaledTimeZoned(date: Date | string): number;
  getDateFromMouseEvent(event: MouseEvent): Date;
  getEuclideanDistance(x1: number, y1: number, x2: number, y2: number): number;
  getMilestoneColor(type?: string): string;
  resolveMilestoneType(m?: Milestone, g?: d3.Selection<any, any, any, any>): string;
  cancelMilestoneLongPress(): void;
  clearMilestoneHoverTimer(): void;
  createMilestoneLongPressBadge(g: d3.Selection<any, any, any, any>, m: Milestone): d3.Selection<any, any, any, any>;
  openEditMilestoneContextMenu(milestone: Milestone, x: number, y: number, date: Date): void;
  isNowInAssignmentWindow(): boolean;
  /* Délégations vers les autres renderers (l'interface reste locale à ce module). */
  setupAxis(repositories: Repository[], minDate: Date, maxDate: Date): void;
  getCommitComponent(parent: d3.Selection<any, any, any, any>, commit: Commit, before?: any): any;
  startMilestoneDrag(startX: number, element: d3.Selection<any, any, any, any>, milestone: Milestone): void;
  updateMilestoneDrag(event: MouseEvent, element: d3.Selection<any, any, any, any>, milestone: Milestone): void;
  endMilestoneDrag(element: d3.Selection<any, any, any, any>, hasMoved: boolean): void;
}

export class GraphPointsRenderer {
  public static loadPoints(host: GraphPointsHost): any {
    const overview = host;
    const repositories: Repository[] = host.getDisplayedRepositories();

    if (host.repository_g != null) host.repository_g.remove();

    host.filteredCommitsCount = 0;
    host.filteredStudentsCount = 0;

    let allCommits = repositories.map((v) => v.commits).reduce((a, b) => a.concat(b), []);

    if (repositories.length === 0) {
      if (host.axis_g != null) {
        host.axis_g.remove();
        host.axis_g = null;
      }
      return;
    }

    host.repository_g = host.data_g.append("g");
    host.repositories_g = new Array<any>(repositories.length);

    let minDate: Date, maxDate: Date;

    if (allCommits.length === 0) {
      minDate = host.dataService.startDate ? new Date(host.dataService.startDate) : new Date(Date.now() - 7 * 24 * 3600 * 1000);
      maxDate = host.dataService.endDate ? new Date(host.dataService.endDate) : new Date();
      if (minDate > maxDate) {
        const temp = minDate;
        minDate = maxDate;
        maxDate = temp;
      }
    } else {
      let ext = d3.extent(allCommits, (d) => d.commitDate);
      minDate = ext[0];
      maxDate = ext[1];
    }

    // When "now" is within the assignment window (or that window is unbounded),
    // extend the domain up to it so the marker stays visible and the gap is shown.
    if (host.isNowInAssignmentWindow()) {
      const now = host.clockService.now();
      if (now < minDate) minDate = now;
      if (now > maxDate) maxDate = now;
    }

    // Add 2% padding to the graph's time domain so elements don't touch the edges
    if (minDate && maxDate) {
      let timeDiff = maxDate.getTime() - minDate.getTime();
      if (timeDiff === 0) timeDiff = 24 * 3600 * 1000; // 1 day minimum span
      let padding = timeDiff * 0.02;
      minDate = new Date(minDate.getTime() - padding);
      maxDate = new Date(maxDate.getTime() + padding);
    }

    // Keep a minimum forward headroom so the "now" marker does not outrun the
    // domain and force frequent full re-renders.
    if (minDate && maxDate && host.isNowInAssignmentWindow()) {
      const now = host.clockService.now();
      const minHeadroom = 30 * 60 * 1000;
      if (maxDate.getTime() < now.getTime() + minHeadroom) {
        maxDate = new Date(now.getTime() + minHeadroom);
      }
    }

    host.setupAxis(repositories, minDate, maxDate);

    host.maxZoom = (maxDate.getTime() - minDate.getTime()) / (1000 * 60);

    host.repository_g
      .selectAll(".repository")
      .data(repositories)
      .enter()
      .append("g")
      .each(function (repository: Repository, i: number) {
        host.repositories_g[i] = d3.select(this);
        host.repositories_g[i].classed("repository", true);
        host.repositories_g[i].attr("repository_index", i).attr("transform", `translate(0, ${host.y_scale(i + 1)})`);

        let before = undefined;
        let commits = repository.commits
          .filter((commit) => host.isCommitMatchingFilter(commit))
          .sort((a, b) => a.commitDate.getTime() - b.commitDate.getTime());

        host.filteredCommitsCount += commits.length;
        if (commits.length > 0) {
          host.filteredStudentsCount++;

          let minDateTime: number, maxDateTime: number;

          let lines = [];
          let current_line: Commit | undefined = undefined;

          commits.forEach((commit) => {
            minDateTime = minDateTime == null ? commit.commitDate.getTime() : Math.min(commit.commitDate.getTime(), minDateTime);
            maxDateTime = maxDateTime == null ? commit.commitDate.getTime() : Math.max(commit.commitDate.getTime(), maxDateTime);
            if (commit.message === "Resume") current_line = commit;
            else if (commit.message === "Pause" && current_line) {
              lines.push([current_line.commitDate, commit.commitDate]);
              current_line = undefined;
            }
            before = overview.getCommitComponent(d3.select(this), commit, before);
          });

          if (lines.length === 0) {
            lines.push([new Date(minDateTime), new Date(maxDateTime)]);
          }

          lines.forEach(([d1, d2]) => {
            host.repositories_g[i]
              .insert("line", ":first-child")
              .attr("class", "commit_line")
              .attr("min_date", d1.getTime())
              .attr("max_date", d2.getTime());
          });
        }
      });
  }

  public static setupMilestoneInteractions(host: GraphPointsHost, g: d3.Selection<any, any, any, any>, m: Milestone): any {
    const overview = host;

    g.select(".hitbox").on("mousedown", (e: MouseEvent) => {
      // Left click only
      if (e.button !== 0) return;
      if (host.isDraggingMilestone) return;

      e.stopPropagation();
      e.preventDefault();

      host.clearMilestoneHoverTimer();
      if (host.hovered_milestone) {
        host.hovered_milestone = undefined;
        host.tooltipService.hide();
      }

      const startClientX = e.clientX;
      const startClientY = e.clientY;
      const originalDate = new Date(m.date.getTime());
      let isLongPressFulfilled = false;
      let hasMovedDuringDrag = false;

      host.cancelMilestoneLongPress();

      const badge = host.createMilestoneLongPressBadge(g, m);
      host.activeMilestoneBadge = badge;

      host.milestoneLongPressTimer = setTimeout(() => {
        isLongPressFulfilled = true;
        badge.classed("drag-ready", true);
        document.body.style.cursor = "grabbing";

        const currentMilestoneX = host.xScaledTimeZoned(m.date);
        overview.startMilestoneDrag(currentMilestoneX, g, m);
      }, host.MILESTONE_HOLD_DURATION);

      const onWindowMouseMove = (moveEvent: MouseEvent) => {
        const dist = host.getEuclideanDistance(startClientX, startClientY, moveEvent.clientX, moveEvent.clientY);

        if (!isLongPressFulfilled) {
          if (dist > host.MILESTONE_DRAG_JITTER_TOLERANCE) {
            host.ignoreNextMilestoneClick = true;
            setTimeout(() => {
              host.ignoreNextMilestoneClick = false;
            }, host.MILESTONE_CLICK_SUPPRESSION_DELAY);
            host.cancelMilestoneLongPress();
          }
        } else {
          hasMovedDuringDrag = true;
          overview.updateMilestoneDrag(moveEvent, g, m);
        }
      };

      const onWindowMouseUp = (upEvent: MouseEvent) => {
        const dist = host.getEuclideanDistance(startClientX, startClientY, upEvent.clientX, upEvent.clientY);

        host.cancelMilestoneLongPress();

        if (!isLongPressFulfilled) {
          if (dist <= host.MILESTONE_DRAG_JITTER_TOLERANCE && upEvent.button === 0) {
            host.ignoreNextMilestoneClick = true;
            setTimeout(() => {
              host.ignoreNextMilestoneClick = false;
            }, host.MILESTONE_CLICK_SUPPRESSION_DELAY);
            document.dispatchEvent(
              new MouseEvent("click", {
                bubbles: true,
                cancelable: true,
                clientX: upEvent.clientX,
                clientY: upEvent.clientY,
              }),
            );
            const rawDate = host.getDateFromMouseEvent(upEvent);
            host.openEditMilestoneContextMenu(m, upEvent.pageX, upEvent.pageY, rawDate);
          }
        } else {
          host.ignoreNextMilestoneClick = true;
          setTimeout(() => {
            host.ignoreNextMilestoneClick = false;
          }, host.MILESTONE_CLICK_SUPPRESSION_DELAY);
          overview.endMilestoneDrag(g, hasMovedDuringDrag);
        }
      };

      const onWindowBlur = () => {
        if (isLongPressFulfilled && !hasMovedDuringDrag) {
          m.date = originalDate;
          const restoredX = host.xScaledTimeZoned(originalDate);
          g.attr("transform", `translate(${restoredX}, ${host.inner_margin.top})`);
        }
        host.cancelMilestoneLongPress();
        if (isLongPressFulfilled) {
          overview.endMilestoneDrag(g, false);
        }
      };

      const cleanup = () => {
        window.removeEventListener("mousemove", onWindowMouseMove);
        window.removeEventListener("mouseup", onWindowMouseUp);
        window.removeEventListener("blur", onWindowBlur);
      };

      host.activeMilestoneCleanupFn = cleanup;
      window.addEventListener("mousemove", onWindowMouseMove);
      window.addEventListener("mouseup", onWindowMouseUp);
      window.addEventListener("blur", onWindowBlur);
    });
  }

  public static buildMilestoneGraphics(host: GraphPointsHost, g: d3.Selection<any, any, any, any>, m: Milestone, index: number): any {
    if (!m.type) {
      m.type = host.resolveMilestoneType(m, g);
    }

    const milestoneType = host.resolveMilestoneType(m, g);
    const milestoneColor = host.getMilestoneColor(milestoneType);

    // 1. Line
    const lineY = 0;
    const lineH = host.inner_height;

    g.append("rect")
      .attr("class", "milestone-vertical-line")
      .attr("x", 0)
      .attr("y", lineY)
      .attr("width", 1)
      .attr("height", lineH)
      .attr("transform", "translate(" + [-0.5, 0] + ")");

    // 2. Label group (anchored, masked when overlapping newer milestones)
    const labelGroup = g.append("g").attr("class", "milestone-label-group");

    // Text
    const labelText = m.label || (m.type.endsWith("s") ? m.type.slice(0, -1) : m.type) + " " + index;

    let text = labelGroup.append("text").attr("class", "milestone-text").text(labelText).attr("text-anchor", "middle");

    let textWidth = 40;
    try {
      const node = text.node();
      if (node && typeof node.getBBox === "function") {
        const bbox = node.getBBox();
        if (bbox && bbox.width > 0) {
          textWidth = bbox.width;
        }
      }
    } catch {
      textWidth = labelText.length * 7.5;
    }

    const paddingX = 4;
    const barWidth = Math.max(20, textWidth + paddingX * 2);

    text.attr("y", -10);

    labelGroup
      .append("rect")
      .attr("class", "milestone-bottom-bar")
      .attr("x", -barWidth / 2)
      .attr("y", -2)
      .attr("width", barWidth)
      .attr("height", 2)
      .attr("rx", 1.5)
      .attr("ry", 1.5);

    const badgeX = barWidth / 2 - 2;
    const badgeY = -10;

    g.append("rect")
      .attr("class", "hitbox")
      .attr("width", barWidth + 30)
      .attr("height", 24)
      .attr("x", -(barWidth + 30) / 2)
      .attr("y", -24)
      .attr("style", "cursor: pointer; pointer-events: all;");

    g.attr("data-badge-x", badgeX).attr("data-badge-y", badgeY);
  }
}
