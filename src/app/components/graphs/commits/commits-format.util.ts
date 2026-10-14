import * as d3 from "d3";

/**
 * Date formatters of the commits graph, shared by the component and its renderers
 * (they must not import each other just for two `d3.timeFormat` instances).
 */

/** Day label of the drag time indicator and of the tooltips. */
export const formatCommitDay = d3.timeFormat("%d/%m/%Y");
/** Hour label of the drag time indicator and of the "now" marker. */
export const formatCommitHour = d3.timeFormat("%H:%M");
