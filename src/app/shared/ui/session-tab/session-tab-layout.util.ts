import { Session } from "@models/Session.model";
import { MINUTE_MS } from "@services/clock.service";

/**
 * Pure helpers of the live session panel: session boundaries (including the midnight wrap-around),
 * the default session pick and the swap distances published to the CSS of the rail.
 *
 * Kept outside the component so these rules can be tested without a live session nor a browser.
 */

/** Timestamp of a session boundary, accepting both `Date` and ISO strings. */
export function sessionBoundaryMs(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * Start and end of a session. Sessions may wrap around midnight (see `EditSessionComponent`), in
 * which case the end is pushed to the next day so durations stay positive.
 */
export function sessionWindow(session: Session): { start: number; end: number } {
  const start = sessionBoundaryMs(session.startDate);
  const rawEnd = sessionBoundaryMs(session.endDate);
  return { start, end: rawEnd < start ? rawEnd + 24 * 60 * MINUTE_MS : rawEnd };
}

/** Default pick: the most recently started running session, else the soonest upcoming one. */
export function pickDefaultSession(sessions: Session[], now: number): Session | null {
  if (!sessions.length) {
    return null;
  }

  const startOf = (session: Session) => sessionWindow(session).start;
  const running = sessions.filter((session) => {
    const { start, end } = sessionWindow(session);
    return now >= start && now <= end;
  });

  if (running.length) {
    return running.reduce((a, b) => (startOf(b) >= startOf(a) ? b : a));
  }
  return sessions.reduce((a, b) => (startOf(b) <= startOf(a) ? b : a));
}

/**
 * Publishes the three swap distances as CSS custom properties on the rail.
 * They depend on the text lengths, which CSS cannot read, so they come from the DOM.
 * `offsetHeight` is layout-only, so a transform in flight does not corrupt the reading.
 */
export function publishRailMetrics(rail: HTMLElement): void {
  const counter = rail.querySelector<HTMLElement>(".peek-counter__text");
  const incoming = rail.querySelector<HTMLElement>(".peek-line--in");
  const outgoing = rail.querySelector<HTMLElement>(".peek-line--out");
  if (!counter || !incoming || !outgoing) {
    return;
  }

  const railHeight = rail.clientHeight;
  const counterHeight = counter.offsetHeight;
  const incomingHeight = incoming.offsetHeight;
  const outgoingHeight = outgoing.offsetHeight;
  if (!railHeight || !counterHeight || !incomingHeight || !outgoingHeight) {
    return;
  }

  /* The counter's gap is the shared travel: the labels ride along with it so the three lines
     stay in lockstep. The flush positions are the rail's height minus each text's own length. */
  const travel = Math.max(0, railHeight - counterHeight);
  rail.style.setProperty("--travel", `${travel}px`);
  /* The outgoing label sits flush at the bottom, and its length differs from the incoming one */
  rail.style.setProperty("--out-bottom", `${Math.max(0, railHeight - outgoingHeight)}px`);
  /* Enough to start fully hidden even when the text is longer than the gap */
  rail.style.setProperty("--in-enter", `${Math.max(travel, incomingHeight)}px`);
}
