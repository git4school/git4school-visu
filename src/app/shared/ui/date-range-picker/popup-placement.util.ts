/** Viewport metrics needed to place a popup next to its trigger. */
export interface PopupPlacementInput {
  /** Bounding box of the trigger, in viewport coordinates. */
  triggerRect: { top: number; left: number; bottom: number };
  popupWidth: number;
  popupHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  /** Minimal gap kept between the popup and the viewport edges. */
  margin?: number;
}

/** Offset to apply to the popup, relative to its trigger, plus the flags driving its CSS. */
export interface PopupPlacement {
  left: number;
  top: number;
  /** Popup opened upwards because there is not enough room below. */
  dropUp: boolean;
  /** Popup shifted left because it would overflow the right edge. */
  alignRight: boolean;
}

/** Gap between the trigger and the popup, and kept from the viewport edges. */
const GAP = 8;

/**
 * Places a calendar popup near its trigger: below when it fits, above otherwise, then clamped inside
 * the viewport. Kept pure so the fallback order (below → above → least crowded side) is testable
 * without a browser layout.
 */
export function computePopupPlacement(input: PopupPlacementInput): PopupPlacement {
  const margin = input.margin ?? 12;
  const { top, left, bottom } = input.triggerRect;
  const { popupWidth, popupHeight, viewportWidth, viewportHeight } = input;
  const spaceBelow = viewportHeight - bottom - margin;
  const spaceAbove = top - margin;

  const dropUp = spaceBelow < popupHeight + GAP && spaceAbove > spaceBelow;
  let viewportY: number;

  if (spaceBelow >= popupHeight + GAP) {
    viewportY = bottom + GAP;
  } else if (spaceAbove >= popupHeight + GAP) {
    viewportY = top - GAP - popupHeight;
  } else {
    /* Doesn't fit on either side: keep the roomier side and stay inside the viewport. */
    viewportY = dropUp ? top - GAP - popupHeight : bottom + GAP;
    viewportY = Math.max(margin, Math.min(viewportY, viewportHeight - popupHeight - margin));
  }

  /* In very small viewports, ensure the top stays accessible. */
  if (viewportHeight < popupHeight + margin * 2) {
    viewportY = margin;
  }

  const overflowsRight = left + popupWidth > viewportWidth - margin;
  const alignRight = overflowsRight;
  const viewportX = Math.max(margin, overflowsRight ? viewportWidth - popupWidth - margin : left);

  return { left: viewportX - left, top: viewportY - top, dropUp, alignRight };
}
