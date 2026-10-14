/* eslint-disable max-len */
import * as d3 from "d3";
import { Utils } from "@services/utils";
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
    const { fo } = ctx;

    fo.html(`
      <div class="session-header-inner d-flex align-items-center" style="gap: 4px; height: 100%; min-height: 24px; padding-top: 0; padding-bottom: 0; padding-left: 4px; padding-right: 4px; pointer-events: auto; overflow: visible; width: 100%; position: relative;">
        ${this.renderPills(ctx)}
      </div>
    `);
  }

  /* -------------------------------------------------------------
   * Séance superposée (flèches d'arête aux extrémités + badges centrés)
   * ------------------------------------------------------------- */
  private static renderOverlappingSession(ctx: SessionHeaderRenderContext): void {
    const { session, overlapGroup, overview, fo } = ctx;

    if (!overlapGroup || overlapGroup.length <= 1) {
      this.renderSingleSession(ctx);
      return;
    }

    let sessionIdxInGroup = overlapGroup.indexOf(session);
    if (sessionIdxInGroup === -1 && overview && typeof overview.isSameSession === "function") {
      sessionIdxInGroup = overlapGroup.findIndex((s) => overview.isSameSession(s, session));
    }
    const groupSize = overlapGroup.length;

    /* SVG chevrons — stroke cohérent avec les icônes de l'app */
    /* prettier-ignore */
    // eslint-disable-next-line @typescript-eslint/quotes
    const chevronLeft = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>';
    /* prettier-ignore */
    // eslint-disable-next-line @typescript-eslint/quotes
    const chevronRight = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>';

    fo.html(`
      <div class="session-header-inner d-flex align-items-center justify-content-between" style="height: 100%; min-height: 24px; padding-top: 0; padding-bottom: 0; padding-left: 2px; padding-right: 2px; pointer-events: auto; overflow: visible; width: 100%; position: relative;">
        <!-- Left arrow (collée au bord gauche) -->
        <button class="session-edge-arrow session-edge-prev flex-shrink-0" type="button" style="height: 18px; align-self: center;">
          ${chevronLeft}
        </button>

        ${this.renderPills(ctx, {
          centered: true,
          extra: `
          <!-- Compteur (forme originale texte simple) -->
          <span class="session-counter flex-shrink-0" style="font-size: 10px; font-weight: 600; color: var(--color-text-secondary); white-space: nowrap; line-height: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; padding: 0 2px; user-select: none; align-self: center; vertical-align: middle;">${
            sessionIdxInGroup + 1
          }/${groupSize}</span>`,
        })}

        <!-- Right arrow (collée au bord droit) -->
        <button class="session-edge-arrow session-edge-next flex-shrink-0" type="button" style="height: 18px; align-self: center;">
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
   * Helper : Range la pastille "nom de séance", le groupe, la note et
   * l'indicateur "..." (partagés par l'en-tête simple et l'en-tête superposé)
   * ------------------------------------------------------------- */
  private static renderPills(ctx: SessionHeaderRenderContext, options: { centered?: boolean; extra?: string } = {}): string {
    const { centered = false, extra = "" } = options;
    const classes = centered
      ? "session-header-pills-container d-flex align-items-center justify-content-center"
      : "session-header-pills-container d-flex align-items-center";
    const centeredPadding = centered ? "padding: 0 4px;" : "";

    return `
        <div class="${classes}" style="gap: 4px; overflow: visible; min-width: 0; flex: 1 1 auto; height: 100%; ${centeredPadding} flex-wrap: nowrap;">
          <!-- Pill 1: Nom de séance -->
          <span class="badge session-pill session-name-pill d-inline-flex align-items-center" style="box-sizing: border-box; background: var(--color-surface); border: 1px solid rgba(56, 189, 248, 0.4); color: var(--color-text-primary); font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 9999px; white-space: nowrap; gap: 4px; height: 18px; line-height: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.05); flex-shrink: 0; min-width: 0; overflow: hidden; pointer-events: auto; align-self: center;">
            ${ctx.calendarSvg}
            <span class="session-pill-text session-name-text text-truncate" style="min-width: 0; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block;">${
              ctx.displayName
            }</span>
          </span>

          <!-- Pill 2: Groupe de TP -->
          ${this.renderGroupPill(ctx.groupName, ctx.usersSvg)}

          <!-- Pill 3: Note button -->
          ${this.renderNoteButton(ctx.hasNotes, ctx.noteSvg)}

          <!-- More indicator (...) when some info is hidden -->
          ${this.renderMoreIndicator()}${extra}
        </div>`;
  }

  /** Pastille ronde "note" affichée seulement quand la séance porte des notes. */
  private static renderNoteButton(hasNotes: boolean, noteSvg: string): string {
    if (!hasNotes) {
      return "";
    }

    return `
          <span role="button" tabindex="0" class="btn session-note-btn flex-shrink-0 d-inline-flex align-items-center justify-content-center p-0" style="box-sizing: border-box; width: 18px; height: 18px; min-width: 18px; min-height: 18px; border-radius: 50%; background: var(--color-surface); border: 1px solid rgba(56, 189, 248, 0.45); color: var(--color-primary); box-shadow: 0 1px 2px rgba(0,0,0,0.05); cursor: pointer; pointer-events: auto; align-self: center;">
            ${noteSvg}
          </span>`;
  }

  /** Indicateur "..." révélé par le CSS quand une information est masquée. */
  private static renderMoreIndicator(): string {
    return `
          <span role="button" tabindex="0" class="session-more-btn flex-shrink-0 d-inline-flex align-items-center justify-content-center" style="width: 16px; height: 18px; cursor: pointer; pointer-events: auto; display: none; background: transparent; border: none; padding: 0; align-self: center;">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style="flex-shrink: 0; display: block;">
              <circle cx="2.5" cy="8" r="1.8" />
              <circle cx="8" cy="8" r="1.8" />
              <circle cx="13.5" cy="8" r="1.8" />
            </svg>
          </span>`;
  }

  /* -------------------------------------------------------------
   * Helper : Construit la carte tooltip riche d'une séance cible
   * ------------------------------------------------------------- */
  private static buildSessionTooltipHtml(title: string, session: Session, overview: any): string {
    const sName = Utils.escapeHtml(overview.getSessionDisplayName(session));
    const sGroup = session.tpGroup ? Utils.escapeHtml(session.tpGroup) : "";
    const timeFormatted = Utils.escapeHtml(overview.formatSessionTime(session));
    const hasNotes = !!(session.notes && session.notes.trim().length > 0);
    const notesEscaped = hasNotes ? Utils.escapeHtml(session.notes.trim()) : "";

    return `
      <div style="text-align: left; min-width: 180px; max-width: 260px; font-family: inherit;">
        <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-text-muted); margin-bottom: 4px;">
          ${title}
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 3px;">
          <span style="font-weight: 600; color: var(--color-primary); font-size: 0.88rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${sName}
          </span>
          ${this.renderGroupPill(sGroup, this.renderUsersSvg())}
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

  private static renderGroupPill(groupName: string, usersSvg: string): string {
    if (!groupName) return "";

    return `
      <span class="badge session-pill session-group-pill d-inline-flex align-items-center">
        ${usersSvg}
        <span class="session-pill-text session-group-text text-truncate">${Utils.escapeHtml(groupName)}</span>
      </span>
    `;
  }

  private static renderUsersSvg(): string {
    // eslint-disable-next-line @typescript-eslint/quotes
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>';
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
