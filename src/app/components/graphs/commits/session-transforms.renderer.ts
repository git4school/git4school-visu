import * as d3 from "d3";
import { Session } from "@models/Session.model";

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

        // Width estimations
        const charWidth = 6.2;
        const iconAndPadding = 29; // 11px icon + 4px gap + 14px padding
        const nameNeeded = iconAndPadding + displayName.length * charWidth;
        const groupNeeded = hasGroup ? iconAndPadding + groupName.length * charWidth : 0;
        const noteBtnWidth = hasNotes ? 20 : 0;
        const moreBtnWidth = 16; // width of "..." dots
        const gap = 4;
        const padTotal = 8;

        // Total needed to display all available session elements in full
        const neededAll = nameNeeded + (hasGroup ? gap + groupNeeded : 0) + (hasNotes ? gap + noteBtnWidth : 0) + padTotal;

        if (availWidth >= neededAll) {
          // Case 1: Everything fits without truncation
          if (!namePill.empty()) {
            namePill.style("display", "inline-flex").style("max-width", "none");
          }
          if (!groupPill.empty()) {
            groupPill.style("display", "inline-flex").style("max-width", "none");
          }
          if (!noteBtn.empty()) {
            noteBtn.style("display", "inline-flex");
          }
          if (!moreBtn.empty()) {
            moreBtn.style("display", "none");
          }
        } else {
          // Case 2: Constrained width - priority: Name > Group > Note
          // When an item cannot be displayed or is truncated, show "..." (moreBtn) to indicate hidden info
          const neededNameAndGroup = nameNeeded + (hasGroup ? gap + groupNeeded : 0) + padTotal;
          const neededNameGroupMore = neededNameAndGroup + (hasNotes ? gap + moreBtnWidth : 0);

          if (hasGroup && availWidth >= neededNameGroupMore) {
            // Name full, Group full, Note dropped -> show "..." if hasNotes
            if (!namePill.empty()) {
              namePill.style("display", "inline-flex").style("max-width", "none");
            }
            if (!groupPill.empty()) {
              groupPill.style("display", "inline-flex").style("max-width", "none");
            }
            if (!noteBtn.empty()) {
              noteBtn.style("display", "none");
            }
            if (!moreBtn.empty()) {
              moreBtn.style("display", hasNotes ? "inline-flex" : "none");
            }
          } else if (hasGroup && availWidth >= nameNeeded + gap + 38 + (hasNotes ? gap + moreBtnWidth : 0) + padTotal) {
            // Name full, Group truncated with ellipsis, Note dropped -> show "..." if hasNotes
            const availableForGroup = availWidth - nameNeeded - (hasNotes ? gap + moreBtnWidth : 0) - gap - padTotal;
            if (!namePill.empty()) {
              namePill.style("display", "inline-flex").style("max-width", "none");
            }
            if (!groupPill.empty()) {
              groupPill.style("display", "inline-flex").style("max-width", `${Math.max(34, availableForGroup)}px`);
            }
            if (!noteBtn.empty()) {
              noteBtn.style("display", "none");
            }
            if (!moreBtn.empty()) {
              moreBtn.style("display", "inline-flex");
            }
          } else if (availWidth >= nameNeeded + (hasGroup || hasNotes ? gap + moreBtnWidth : 0) + padTotal) {
            // Name full, Group dropped, Note dropped -> show "..." if hasGroup or hasNotes
            if (!namePill.empty()) {
              namePill.style("display", "inline-flex").style("max-width", "none");
            }
            if (!groupPill.empty()) {
              groupPill.style("display", "none");
            }
            if (!noteBtn.empty()) {
              noteBtn.style("display", "none");
            }
            if (!moreBtn.empty()) {
              moreBtn.style("display", hasGroup || hasNotes ? "inline-flex" : "none");
            }
          } else if (availWidth >= 38 + (hasGroup || hasNotes ? gap + moreBtnWidth : 0) + padTotal) {
            // Name truncated with ellipsis, Group & Note dropped -> show "..." if hasGroup or hasNotes
            const availableForName = availWidth - (hasGroup || hasNotes ? gap + moreBtnWidth : 0) - padTotal;
            if (!namePill.empty()) {
              namePill.style("display", "inline-flex").style("max-width", `${Math.max(34, availableForName)}px`);
            }
            if (!groupPill.empty()) {
              groupPill.style("display", "none");
            }
            if (!noteBtn.empty()) {
              noteBtn.style("display", "none");
            }
            if (!moreBtn.empty()) {
              moreBtn.style("display", hasGroup || hasNotes ? "inline-flex" : "none");
            }
          } else if (availWidth >= 55) {
            // Only enough room for Name truncated with ellipsis
            if (!namePill.empty()) {
              namePill.style("display", "inline-flex").style("max-width", `${availWidth - 6}px`);
            }
            if (!groupPill.empty()) {
              groupPill.style("display", "none");
            }
            if (!noteBtn.empty()) {
              noteBtn.style("display", "none");
            }
            if (!moreBtn.empty()) {
              moreBtn.style("display", "none");
            }
          } else {
            // Width below 55px: Too small for Name pill.
            // Hide pills; navigation controls (< 1/5 >) remain visible if overlapping.
            if (!namePill.empty()) {
              namePill.style("display", "none");
            }
            if (!groupPill.empty()) {
              groupPill.style("display", "none");
            }
            if (!noteBtn.empty()) {
              noteBtn.style("display", "none");
            }
            if (!moreBtn.empty()) {
              moreBtn.style("display", "none");
            }
          }
        }
      });
    }
  }
}
