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

    this.attachTooltip(fo.select(".session-edge-prev"), svc, () => {
      const prev = (getIdx() - 1 + len) % len;
      return `Séance précédente (${prev + 1}/${len})`;
    });
    fo.select(".session-edge-prev").on("click", (e: MouseEvent) => {
      e.stopPropagation();
      svc.hide();
      overview.activeSessionIndices.set(groupId, (getIdx() - 1 + len) % len);
      overview.updateSessionsTransforms();
    });

    this.attachTooltip(fo.select(".session-edge-next"), svc, () => {
      const next = (getIdx() + 1) % len;
      return `Séance suivante (${next + 1}/${len})`;
    });
    fo.select(".session-edge-next").on("click", (e: MouseEvent) => {
      e.stopPropagation();
      svc.hide();
      overview.activeSessionIndices.set(groupId, (getIdx() + 1) % len);
      overview.updateSessionsTransforms();
    });
  }

  /* -------------------------------------------------------------
   * Helper : Attache les events de tooltip sur une sélection D3 HTML.
   * ------------------------------------------------------------- */
  private static attachTooltip(
    selection: d3.Selection<any, any, any, any>,
    svc: any,
    getText: () => string,
    placement: "top" | "bottom" | "left" | "right" = "bottom",
  ): void {
    selection
      .on("mouseenter", function (this: HTMLElement) {
        svc.show(getText(), this, placement);
      })
      .on("mouseleave", () => svc.hide())
      .on("mousedown", () => svc.hide());
  }
}
