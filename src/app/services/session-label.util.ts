import { Session } from "@models/Session.model";
import { TranslateService } from "@ngx-translate/core";

export interface SessionDisplayNameOptions {
  /** Append " (group)" when the session has a TP group and no global group filter is active. */
  includeGroupSuffix?: boolean;
  /** The globally selected TP group filter. */
  groupFilter?: string;
}

/**
 * Chronological rank (1-based) of a session within its TP group, matching the graph's
 * default numbering. Returns 1 when the session cannot be located.
 */
export function getSessionOrdinal(session: Session, sessions: Session[]): number {
  if (!session) {
    return 1;
  }
  const group = session.tpGroup || "";
  const sameGroup = (sessions || [])
    .filter((s) => (s.tpGroup || "") === group)
    .slice()
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  let idx = sameGroup.indexOf(session);
  if (idx === -1) {
    idx = sameGroup.findIndex(
      (s) =>
        new Date(s.startDate).getTime() === new Date(session.startDate).getTime() &&
        new Date(s.endDate).getTime() === new Date(session.endDate).getTime(),
    );
  }
  return idx >= 0 ? idx + 1 : 1;
}

/**
 * Single source of truth for a session's display name: the explicit label when set, otherwise
 * the default "Séance N" (from DEFAULT-SESSION-NAME), optionally suffixed with the TP group.
 * Used by the commits graph, the sessions graph and the live session panel so they never diverge.
 */
export function getSessionDisplayName(
  session: Session,
  sessions: Session[],
  translate: TranslateService,
  options: SessionDisplayNameOptions = {},
): string {
  if (!session) {
    return "";
  }

  const suffix = options.includeGroupSuffix && session.tpGroup && !options.groupFilter ? ` (${session.tpGroup})` : "";

  if (session.label && session.label.trim().length > 0) {
    return `${session.label.trim()}${suffix}`;
  }

  const num = getSessionOrdinal(session, sessions);
  const defaultName = translate.instant("DEFAULT-SESSION-NAME", { number: num });
  const base = defaultName && defaultName !== "DEFAULT-SESSION-NAME" ? defaultName : `${translate.instant("SESSION") || "Séance"} ${num}`;
  return `${base}${suffix}`;
}
