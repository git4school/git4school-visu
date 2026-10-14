import * as d3 from "d3";
import { Session } from "@models/Session.model";
import { choosePillsLayout, PillStyle } from "./session-pills-layout.util";

/**
 * Positioning of the session bands and of their top-strip headers: horizontal offsets from the time
 * scale, vertical offsets from the top strip, opacity of the inactive cards of an overlap group.
 *
 * Extracted from `CommitsComponent` (241 lines of pure geometry, no event wiring) so the graph
 * component keeps only state and interactions.
 */

/** View members the session transforms need from `CommitsComponent`. */
export interface SessionTransformsHost {
  /** Group of session bands (below the repositories). */
  session_g: d3.Selection<any, any, any, any>;
  /** Group of session headers (sticky top strip). */
  session_header_g: d3.Selection<any, any, any, any>;
  inner_margin: any;
  inner_width: number;
  activeSessionIndices: Map<string, number>;
  getActiveSession(session: Session): Session;
  getGroupId(group: Session[]): string;
  getSessionDisplayName(session: Session): string;
  getSessionOverlapGroup(session: Session): Session[] | null;
  isSameSession(a: Session, b: Session): boolean;
  xScaledTimeZoned(date: Date | string): number;
  updateSessionVisibility(shouldRaise?: boolean): void;
}

/** Applies a computed pill style to a (possibly missing) element of the header row. */
function applyPillStyle(element: d3.Selection<any, any, any, any>, style: PillStyle): void {
  if (element.empty()) {
    return;
  }
  element.style("display", style.display);
  element.style("max-width", style.maxWidth === "none" ? "none" : `${style.maxWidth}px`);
}

export class SessionTransformsRenderer {
  /** Applies the current scale and layout to every session band and header. */
  public static apply(host: SessionTransformsHost): void {
    if (!host.session_g) return;

    SessionTransformsRenderer.applyBands(host);
    SessionTransformsRenderer.applyHeaders(host);
    host.updateSessionVisibility(false);
  }

  /** Places every session band on the time scale and dims the inactive cards of a group. */
  private static applyBands(host: SessionTransformsHost): void {
    host.session_g.selectAll(".session-container").each(function (s: Session) {
      const g = d3.select(this);
      const rawX1 = host.xScaledTimeZoned(s.startDate);
      const rawX2 = host.xScaledTimeZoned(s.endDate);

      const visX1 = Math.max(0, rawX1);
      const visX2 = Math.min(host.inner_width, rawX2);
      const visWidth = Math.max(0, visX2 - visX1);

      const isVisible = !isNaN(rawX1) && !isNaN(rawX2) && rawX2 > 0 && rawX1 < host.inner_width && visWidth > 0;
      g.style("display", isVisible ? null : "none").style("visibility", isVisible ? "visible" : "hidden");

      if (!isVisible) {
        return;
      }

      const overlapGroup = host.getSessionOverlapGroup(s);
      const isOverlap = !!(overlapGroup && overlapGroup.length > 1);
      if (isOverlap) {
        const activeSession = host.getActiveSession(s);
        const isActive = host.isSameSession(s, activeSession);
        g.style("opacity", isActive ? null : "0.25");
      } else {
        g.style("opacity", null);
      }

      g.select(".session-body").attr("x", visX1).attr("width", visWidth);

      const showLeft = rawX1 >= 0 && rawX1 <= host.inner_width;
      g.select(".session-edge-left")
        .attr("x1", rawX1)
        .attr("x2", rawX1)
        .style("display", showLeft ? "inline" : "none");

      const showRight = rawX2 >= 0 && rawX2 <= host.inner_width;
      g.select(".session-edge-right")
        .attr("x1", rawX2)
        .attr("x2", rawX2)
        .style("display", showRight ? "inline" : "none");
    });
  }

  /** Places every session header (background, accent bar, edges, sticky pills). */
  private static applyHeaders(host: SessionTransformsHost): void {
    if (host.session_header_g) {
      host.session_header_g.selectAll(".session-header-container").each(function (s: Session) {
        const g = d3.select(this);
        const fo = g.select(".session-header-fo");

        const overlapGroup = host.getSessionOverlapGroup(s);
        const isOverlap = !!(overlapGroup && overlapGroup.length > 1);

        if (isOverlap) {
          const activeSession = host.getActiveSession(s);
          const isActive = host.isSameSession(s, activeSession);
          if (!isActive) {
            g.style("display", "none").style("visibility", "hidden").style("pointer-events", "none");
            if (!fo.empty()) {
              fo.style("display", "none").style("visibility", "hidden").style("pointer-events", "none");
            }
            return;
          }
        }

        const rawX1 = host.xScaledTimeZoned(s.startDate);
        const rawX2 = host.xScaledTimeZoned(s.endDate);

        const visX1 = Math.max(0, rawX1);
        const visX2 = Math.min(host.inner_width, rawX2);
        const visWidth = Math.max(0, visX2 - visX1);

        const isVisible = !isNaN(rawX1) && !isNaN(rawX2) && rawX2 > 0 && rawX1 < host.inner_width && visWidth > 0;

        if (!isVisible) {
          g.style("display", "none").style("visibility", "hidden").style("pointer-events", "none");
          if (!fo.empty()) {
            fo.style("display", "none").style("visibility", "hidden").style("pointer-events", "none");
          }
          return;
        }

        g.style("display", null).style("visibility", "visible").style("pointer-events", "auto");

        // 1. Continuous header background (clamped to 0..inner_width)
        const headerY = 0;
        const headerH = host.inner_margin.top;

        g.select(".session-header-bg").attr("x", visX1).attr("y", headerY).attr("height", headerH).attr("width", visWidth);

        // 2. Top blue accent bar (above milestone labels)
        g.select(".session-header-top-bar").attr("x", visX1).attr("y", headerY).attr("height", 2.5).attr("width", visWidth);

        // 3. Dashed vertical lines going all the way to y = 0
        const showLeft = rawX1 >= 0 && rawX1 <= host.inner_width;
        g.select(".session-header-edge-left")
          .attr("x1", rawX1)
          .attr("x2", rawX1)
          .style("display", showLeft ? "inline" : "none");

        const showRight = rawX2 >= 0 && rawX2 <= host.inner_width;
        g.select(".session-header-edge-right")
          .attr("x1", rawX2)
          .attr("x2", rawX2)
          .style("display", showRight ? "inline" : "none");

        // 4. Sticky badges: stick to x = 0 if rawX1 < 0, otherwise sit at rawX1
        const foX = visX1;
        const foWidth = Math.max(0, visX2 - foX);
        const foY = 0;
        const foH = 24;

        fo.attr("x", foX).attr("y", foY).attr("width", foWidth).attr("height", foH);

        const displayName = host.getSessionDisplayName(s);
        const groupName = s.tpGroup || "";
        const hasNotes = !!(s.notes && s.notes.trim().length > 0);
        const hasGroup = !!groupName;

        const namePill = g.select(".session-name-pill");
        const groupPill = g.select(".session-group-pill");
        const noteBtn = g.select(".session-note-btn");
        const moreBtn = g.select(".session-more-btn");

        if (!namePill.empty()) {
          namePill.select(".session-name-text").text(displayName);
        }

        const navReservedWidth = isOverlap ? 74 : 0; // Left arrow (~22px) + Right arrow (~22px) + Counter (~22px) + gaps (~8px)
        const minFoWidth = isOverlap ? 74 : 55;

        if (isOverlap && overlapGroup) {
          const groupId = host.getGroupId(overlapGroup);
          const currentIdx = host.activeSessionIndices.get(groupId) ?? 0;
          const counterText = g.select(".session-counter-text, .session-counter");
          if (!counterText.empty()) {
            counterText.text(`${currentIdx + 1}/${overlapGroup.length}`);
          }
        }

        if (foWidth < minFoWidth) {
          // Extremely narrow: hide badges completely
          fo.style("display", "none").style("visibility", "hidden").style("pointer-events", "none");
          return;
        }

        fo.style("display", null).style("visibility", "visible").style("pointer-events", "auto");

        const availWidth = Math.max(0, foWidth - navReservedWidth);

        /* Répartition des pills selon la place disponible (règle pure et testée). */
        const layout = choosePillsLayout({
          availableWidth: availWidth,
          displayNameLength: displayName.length,
          groupNameLength: groupName.length,
          hasGroup,
          hasNotes,
        });
        applyPillStyle(namePill, layout.name);
        applyPillStyle(groupPill, layout.group);
        applyPillStyle(noteBtn, layout.note);
        applyPillStyle(moreBtn, layout.more);
      });
    }
  }
}
