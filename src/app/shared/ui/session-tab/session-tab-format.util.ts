import * as moment from "moment";
import { MINUTE_MS } from "@services/clock.service";
import { Utils } from "@services/utils";

/**
 * Pure formatting and SVG-path helpers of the live session panel.
 *
 * They are the parts of the panel that do not depend on its state (refresh ticks, rail measuring,
 * selection), which keeps the countdown/duration/label rules testable on their own.
 */

/** SVG polyline points (0..100 box) from a list of {x,y}. */
export function buildPolyline(points: Array<{ x: number; y: number }>): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}

/** Polygon points (0..100 box) closing the curve along the baseline. */
export function buildArea(points: Array<{ x: number; y: number }>): string {
  if (!points.length) {
    return "";
  }
  return `0,100 ${buildPolyline(points)} 100,100`;
}

/** HTML list tooltip, same markup as the sessions view's resolved-questions tooltip. */
export function buildListTooltip(title: string, emptyLabel: string, items: string[]): string {
  const safeTitle = Utils.escapeHtml(title);
  const list = (items || []).filter((item) => item && item.trim());
  const container = `<div class="resolved-questions-tooltip"><div class="resolved-questions-tooltip-title">${safeTitle}</div>`;

  if (!list.length) {
    return `${container}<div class="peek-tooltip-empty">${Utils.escapeHtml(emptyLabel)}</div></div>`;
  }

  const lis = list.map((item) => `<li>${Utils.escapeHtml(item)}</li>`).join("");
  return `${container}<ul>${lis}</ul></div>`;
}

/** Weekday + date label, localised with the current language. */
export function formatDateLabel(ms: number, lang: string): string {
  moment.locale(lang || "en");
  return moment(ms).format("dddd D MMMM");
}

/** "1h30" / "45 min". */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / MINUTE_MS));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) {
    return `${hours}h${String(minutes).padStart(2, "0")}`;
  }
  return hours ? `${hours}h` : `${minutes} min`;
}

/** "2:34" under an hour, "1:23:45" above. Language-neutral on purpose. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const hours = Math.floor(total / 3600);
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
