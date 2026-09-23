/* eslint-disable max-len */
import * as d3 from "d3";
import { Session } from "@models/Session.model";

export interface SessionHeaderRenderContext {
  session: Session;
  overlapGroup: Session[] | null;
  overview: any;
  displayName: string;
  groupName: string;
  hasNotes: boolean;
  fo: d3.Selection<SVGForeignObjectElement, any, any, any>;
  calendarSvg: string;
  usersSvg: string;
  noteSvg: string;
}

export class SessionHeaderRenderer {
  public static renderHeader(ctx: SessionHeaderRenderContext): void {
    const isOverlap = !!(ctx.overlapGroup && ctx.overlapGroup.length > 1);
    if (isOverlap) {
      this.renderOverlappingSession(ctx);
    } else {
      this.renderSingleSession(ctx);
    }
  }

  /* -------------------------------------------------------------
   * Séance non superposée (rendu standard sans flèches)
   * ------------------------------------------------------------- */
  private static renderSingleSession(ctx: SessionHeaderRenderContext): void {
    const { displayName, groupName, hasNotes, fo, calendarSvg, usersSvg, noteSvg } = ctx;

    fo.html(`
      <div class="session-header-inner d-flex align-items-center" style="gap: 4px; height: 23px; padding-top: 0; padding-bottom: 0; padding-left: 4px; padding-right: 4px; pointer-events: auto; overflow: hidden; width: 100%; position: relative;">
        <!-- Pill 1: Nom de la séance -->
        <span class="badge session-pill session-name-pill d-inline-flex align-items-center" style="background: var(--color-surface); border: 1px solid rgba(56, 189, 248, 0.4); color: var(--color-text-primary); font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 9999px; white-space: nowrap; gap: 4px; height: 20px; line-height: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.05); flex-shrink: 0; min-width: 0; overflow: hidden; pointer-events: auto;">
          ${calendarSvg}
          <span class="session-pill-text session-name-text text-truncate" style="min-width: 0; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block;">${displayName}</span>
        </span>
        <!-- Pill 2: Groupe de TP -->
        ${
          groupName
            ? `
        <span class="badge session-pill session-group-pill d-inline-flex align-items-center" style="background: var(--color-surface); border: 1px solid rgba(56, 189, 248, 0.4); color: var(--color-text-secondary); font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 9999px; white-space: nowrap; gap: 4px; height: 20px; line-height: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.05); flex-shrink: 0; min-width: 0; overflow: hidden; pointer-events: auto;">
          ${usersSvg}
          <span class="session-pill-text session-group-text text-truncate" style="min-width: 0; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block;">${groupName}</span>
        </span>`
            : ""
        }
        <!-- Pill 3: Note button -->
        ${
          hasNotes
            ? `
        <span role="button" tabindex="0" class="btn session-note-btn flex-shrink-0 d-inline-flex align-items-center justify-content-center p-0" style="width: 20px; height: 20px; min-width: 20px; min-height: 20px; border-radius: 50%; background: var(--color-surface); border: 1px solid rgba(56, 189, 248, 0.45); color: var(--color-primary); box-shadow: 0 1px 2px rgba(0,0,0,0.05); cursor: pointer; pointer-events: auto;">
          ${noteSvg}
        </span>`
            : ""
        }
        <!-- More indicator (...) when some info is hidden -->
        <span role="button" tabindex="0" class="session-more-btn flex-shrink-0 d-inline-flex align-items-center justify-content-center" style="width: 16px; height: 20px; cursor: pointer; pointer-events: auto; display: none; background: transparent; border: none; padding: 0;">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style="flex-shrink: 0; display: block;">
            <circle cx="2.5" cy="8" r="1.8" />
            <circle cx="8" cy="8" r="1.8" />
            <circle cx="13.5" cy="8" r="1.8" />
          </svg>
        </span>
      </div>
    `);
  }

  /* -------------------------------------------------------------
   * Séance superposée (flèches d'arête aux extrémités + badges centrés)
   * ------------------------------------------------------------- */
  private static renderOverlappingSession(ctx: SessionHeaderRenderContext): void {
    const { session, overlapGroup, overview, displayName, groupName, hasNotes, fo, calendarSvg, usersSvg, noteSvg } = ctx;

    if (!overlapGroup || overlapGroup.length <= 1) {
      this.renderSingleSession(ctx);
      return;
    }

    const sessionIdxInGroup = overlapGroup.indexOf(session);
    const groupSize = overlapGroup.length;

    /* SVG chevrons — stroke cohérent avec les icônes de l'app */
    /* prettier-ignore */
    // eslint-disable-next-line @typescript-eslint/quotes
    const chevronLeft = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>';
    /* prettier-ignore */
    // eslint-disable-next-line @typescript-eslint/quotes
    const chevronRight = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>';

    fo.html(`
      <div class="session-header-inner d-flex align-items-center justify-content-between" style="height: 23px; padding-top: 0; padding-bottom: 0; padding-left: 2px; padding-right: 2px; pointer-events: auto; overflow: hidden; width: 100%; position: relative;">
        <!-- Left arrow (collée au bord gauche) -->
        <button class="session-edge-arrow session-edge-prev flex-shrink-0" type="button">
          ${chevronLeft}
        </button>

        <!-- Zone centrale centrée -->
        <div class="d-flex align-items-center justify-content-center" style="gap: 4px; overflow: hidden; min-width: 0; flex: 1 1 auto; padding: 0 4px;">
          <!-- Pill 1: Nom de la séance -->
          <span class="badge session-pill session-name-pill d-inline-flex align-items-center" style="background: var(--color-surface); border: 1px solid rgba(56, 189, 248, 0.4); color: var(--color-text-primary); font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 9999px; white-space: nowrap; gap: 4px; height: 20px; line-height: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.05); flex-shrink: 0; min-width: 0; overflow: hidden; pointer-events: auto;">
            ${calendarSvg}
            <span class="session-pill-text session-name-text text-truncate" style="min-width: 0; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block;">${displayName}</span>
          </span>

          <!-- Pill 2: Groupe de TP -->
          ${
            groupName
              ? `
          <span class="badge session-pill session-group-pill d-inline-flex align-items-center" style="background: var(--color-surface); border: 1px solid rgba(56, 189, 248, 0.4); color: var(--color-text-secondary); font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 9999px; white-space: nowrap; gap: 4px; height: 20px; line-height: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.05); flex-shrink: 0; min-width: 0; overflow: hidden; pointer-events: auto;">
            ${usersSvg}
            <span class="session-pill-text session-group-text text-truncate" style="min-width: 0; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block;">${groupName}</span>
          </span>`
              : ""
          }

          <!-- Pill 3: Note button -->
          ${
            hasNotes
              ? `
          <span role="button" tabindex="0" class="btn session-note-btn flex-shrink-0 d-inline-flex align-items-center justify-content-center p-0" style="width: 20px; height: 20px; min-width: 20px; min-height: 20px; border-radius: 50%; background: var(--color-surface); border: 1px solid rgba(56, 189, 248, 0.45); color: var(--color-primary); box-shadow: 0 1px 2px rgba(0,0,0,0.05); cursor: pointer; pointer-events: auto;">
            ${noteSvg}
          </span>`
              : ""
          }

          <!-- More indicator (...) when some info is hidden -->
          <span role="button" tabindex="0" class="session-more-btn flex-shrink-0 d-inline-flex align-items-center justify-content-center" style="width: 16px; height: 20px; cursor: pointer; pointer-events: auto; display: none; background: transparent; border: none; padding: 0;">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style="flex-shrink: 0; display: block;">
              <circle cx="2.5" cy="8" r="1.8" />
              <circle cx="8" cy="8" r="1.8" />
              <circle cx="13.5" cy="8" r="1.8" />
            </svg>
          </span>

          <!-- Compteur -->
          <span class="session-counter flex-shrink-0" style="font-size: 9px; font-weight: 700; color: var(--color-text-secondary); white-space: nowrap; padding: 0 2px;">${
            sessionIdxInGroup + 1
          }/${groupSize}</span>
        </div>

        <!-- Right arrow (collée au bord droit) -->
        <button class="session-edge-arrow session-edge-next flex-shrink-0" type="button">
          ${chevronRight}
        </button>
      </div>
    `);

    const groupId = overview.getGroupId(overlapGroup);
    const svc = overview.tooltipService;
    const len = overlapGroup.length;

    const getIdx = () => overview.activeSessionIndices.get(groupId) ?? 0;

    this.attachTooltip(
      fo.select(".session-edge-prev"),
      svc,
      () => {
        const prevIdx = (getIdx() - 1 + len) % len;
        const targetSession = overlapGroup[prevIdx];
        const title = `Séance précédente (${prevIdx + 1}/${len})`;
        return this.buildSessionTooltipHtml(title, targetSession, overview);
      },
      "bottom",
      "270px",
    );
    fo.select(".session-edge-prev").on("click", (e: MouseEvent) => {
      e.stopPropagation();
      svc.hide();
      const prevIdx = (getIdx() - 1 + len) % len;
      overview.activeSessionIndices.set(groupId, prevIdx);
      const targetSession = overlapGroup[prevIdx];
      overview.lastFocusedSession = targetSession;
      overview.updateSessionsTransforms();
      overview.updateSessionVisibility(true);
      overview.zoomToSession(targetSession);
    });

    this.attachTooltip(
      fo.select(".session-edge-next"),
      svc,
      () => {
        const nextIdx = (getIdx() + 1) % len;
        const targetSession = overlapGroup[nextIdx];
        const title = `Séance suivante (${nextIdx + 1}/${len})`;
        return this.buildSessionTooltipHtml(title, targetSession, overview);
      },
      "bottom",
      "270px",
    );
    fo.select(".session-edge-next").on("click", (e: MouseEvent) => {
      e.stopPropagation();
      svc.hide();
      const nextIdx = (getIdx() + 1) % len;
      overview.activeSessionIndices.set(groupId, nextIdx);
      const targetSession = overlapGroup[nextIdx];
      overview.lastFocusedSession = targetSession;
      overview.updateSessionsTransforms();
      overview.updateSessionVisibility(true);
      overview.zoomToSession(targetSession);
    });
  }

  /* -------------------------------------------------------------
   * Helper : Construit la carte tooltip riche d'une séance cible
   * ------------------------------------------------------------- */
  private static buildSessionTooltipHtml(title: string, session: Session, overview: any): string {
    const sName = this.escapeHtml(overview.getSessionDisplayName(session));
    const sGroup = session.tpGroup ? this.escapeHtml(session.tpGroup) : "";
    const timeFormatted = this.escapeHtml(overview.formatSessionTime(session));
    const hasNotes = !!(session.notes && session.notes.trim().length > 0);
    const notesEscaped = hasNotes ? this.escapeHtml(session.notes.trim()) : "";

    return `
      <div style="text-align: left; min-width: 180px; max-width: 260px; font-family: inherit;">
        <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-text-muted); margin-bottom: 4px;">
          ${title}
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 3px;">
          <span style="font-weight: 600; color: var(--color-primary); font-size: 0.88rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${sName}
          </span>
          ${
            sGroup
              ? `<span class="badge" style="display: inline-flex; align-items: center; background: rgba(56, 189, 248, 0.15); color: var(--color-text-secondary); font-size: 0.72rem; font-weight: 500; border-radius: 9999px; padding: 1px 7px; height: 18px; line-height: 1; flex-shrink: 0;">${sGroup}</span>`
              : ""
          }
        </div>
        <div style="font-size: 0.78rem; color: var(--color-text-secondary); display: flex; align-items: center; gap: 4px; margin-bottom: ${
          hasNotes ? "6px" : "0"
        };">
          <i class="far fa-clock" style="font-size: 10px;"></i>
          <span>${timeFormatted}</span>
        </div>
        ${
          hasNotes
            ? `<div style="border-top: 1px solid var(--color-border); padding-top: 5px; margin-top: 5px;">
          <p style="margin-bottom: 0; font-size: 0.8rem; color: var(--color-text-primary); white-space: pre-wrap; line-height: 1.3; max-height: 80px; overflow-y: auto;">${notesEscaped}</p>
        </div>`
            : ""
        }
      </div>
    `;
  }

  private static escapeHtml(str: string): string {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  /* -------------------------------------------------------------
   * Helper : Attache les events de tooltip sur une sélection D3 HTML.
   * ------------------------------------------------------------- */
  private static attachTooltip(
    selection: d3.Selection<any, any, any, any>,
    svc: any,
    getText: () => string,
    placement: "top" | "bottom" | "left" | "right" = "bottom",
    maxWidth?: string | number,
  ): void {
    selection
      .on("mouseenter", function (this: HTMLElement) {
        svc.show(getText(), this, placement, undefined, maxWidth);
      })
      .on("mouseleave", () => svc.hide())
      .on("mousedown", () => svc.hide());
  }
}
