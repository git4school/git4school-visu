/**
 * Decides how the pills of a session header fit in the available width.
 *
 * The header row holds four elements (name pill, TP group pill, note button, "…" more button) that
 * cannot wrap: when the session band is narrow, the priority is Name > Group > Note, and a hidden
 * element is signalled by the "…" button. Kept pure so every case is testable without a browser.
 */

/** Characters are proportional; 6.2px is the measured average at the pill font size. */
const CHAR_WIDTH = 6.2;
/** 11px icon + 4px gap + 14px padding of a pill. */
const ICON_AND_PADDING = 29;
const NOTE_BUTTON_WIDTH = 20;
/** Width of the "…" dots. */
const MORE_BUTTON_WIDTH = 16;
const GAP = 4;
const PADDING_TOTAL = 8;
/** Minimal room left for the name (or group) text once truncated. */
const MIN_TEXT_WIDTH = 34;
/** Room needed by a group pill reduced to its icon and a couple of letters. */
const MIN_GROUP_WIDTH = 38;
/** Below this, the name pill is not even shown. */
const MIN_NAME_PILL_WIDTH = 55;

/** Display rule of one pill: hidden, or inline with a max width ("none" = never truncated). */
export interface PillStyle {
  display: "inline-flex" | "none";
  /** Max width applied to the pill ("none" resets a previous truncation), in pixels. */
  maxWidth: number | "none";
}

export interface PillsLayout {
  name: PillStyle;
  group: PillStyle;
  note: PillStyle;
  more: PillStyle;
}

export interface PillsLayoutInput {
  /** Width left for the pills once the navigation arrows are reserved. */
  availableWidth: number;
  /** Length of the (already anonymised) session display name. */
  displayNameLength: number;
  /** Length of the TP group name; ignored when `hasGroup` is false. */
  groupNameLength: number;
  hasGroup: boolean;
  hasNotes: boolean;
}

const hidden: PillStyle = { display: "none", maxWidth: "none" };

/** Full width needed by the pills of a session header. */
function neededWidths(input: PillsLayoutInput) {
  const nameNeeded = ICON_AND_PADDING + input.displayNameLength * CHAR_WIDTH;
  const groupNeeded = input.hasGroup ? ICON_AND_PADDING + input.groupNameLength * CHAR_WIDTH : 0;
  const noteNeeded = input.hasNotes ? GAP + NOTE_BUTTON_WIDTH : 0;
  const moreNeeded = input.hasGroup || input.hasNotes ? GAP + MORE_BUTTON_WIDTH : 0;

  return {
    nameNeeded,
    groupNeeded,
    /** Everything displayed in full. */
    all: nameNeeded + (input.hasGroup ? GAP + groupNeeded : 0) + noteNeeded + PADDING_TOTAL,
    /** Name + group, note dropped, "…" shown. */
    nameGroupMore: nameNeeded + (input.hasGroup ? GAP + groupNeeded : 0) + (input.hasNotes ? GAP + MORE_BUTTON_WIDTH : 0) + PADDING_TOTAL,
    /** Name full + group truncated to its minimum, note dropped, "…" shown. */
    nameGroupTruncated: nameNeeded + GAP + MIN_GROUP_WIDTH + (input.hasNotes ? GAP + MORE_BUTTON_WIDTH : 0) + PADDING_TOTAL,
    /** Name alone, "…" shown when something is hidden. */
    nameMore: nameNeeded + moreNeeded + PADDING_TOTAL,
    /** Truncated name alone, "…" shown when something is hidden. */
    truncatedNameMore: MIN_GROUP_WIDTH + moreNeeded + PADDING_TOTAL,
  };
}

/**
 * Layout of the four pills for the given width.
 * Priority when space shrinks: full → drop the note → truncate the group → drop the group →
 * truncate the name → hide everything.
 */
export function choosePillsLayout(input: PillsLayoutInput): PillsLayout {
  const needed = neededWidths(input);
  const available = input.availableWidth;

  if (available >= needed.all) {
    /* Everything fits without truncation. */
    return {
      name: { display: "inline-flex", maxWidth: "none" },
      group: input.hasGroup ? { display: "inline-flex", maxWidth: "none" } : hidden,
      note: input.hasNotes ? { display: "inline-flex", maxWidth: "none" } : hidden,
      more: hidden,
    };
  }

  if (input.hasGroup && available >= needed.nameGroupMore) {
    /* Name full, group full, note dropped. */
    return {
      name: { display: "inline-flex", maxWidth: "none" },
      group: { display: "inline-flex", maxWidth: "none" },
      note: hidden,
      more: input.hasNotes ? { display: "inline-flex", maxWidth: "none" } : hidden,
    };
  }

  if (input.hasGroup && available >= needed.nameGroupTruncated) {
    /* Name full, group truncated, note dropped. */
    const availableForGroup = available - needed.nameNeeded - (input.hasNotes ? GAP + MORE_BUTTON_WIDTH : 0) - GAP - PADDING_TOTAL;
    return {
      name: { display: "inline-flex", maxWidth: "none" },
      group: { display: "inline-flex", maxWidth: Math.max(MIN_TEXT_WIDTH, availableForGroup) },
      note: hidden,
      more: { display: "inline-flex", maxWidth: "none" },
    };
  }

  if (available >= needed.nameMore) {
    /* Name full, group and note dropped. */
    return {
      name: { display: "inline-flex", maxWidth: "none" },
      group: hidden,
      note: hidden,
      more: idleMoreButton(input),
    };
  }

  if (available >= needed.truncatedNameMore) {
    /* Name truncated, group and note dropped. */
    const availableForName = available - (input.hasGroup || input.hasNotes ? GAP + MORE_BUTTON_WIDTH : 0) - PADDING_TOTAL;
    return {
      name: { display: "inline-flex", maxWidth: Math.max(MIN_TEXT_WIDTH, availableForName) },
      group: hidden,
      note: hidden,
      more: idleMoreButton(input),
    };
  }

  if (available >= MIN_NAME_PILL_WIDTH) {
    /* Only room for a truncated name. */
    return {
      name: { display: "inline-flex", maxWidth: available - 6 },
      group: hidden,
      note: hidden,
      more: hidden,
    };
  }

  /* Too narrow for the name pill: only the navigation controls remain. */
  return { name: hidden, group: hidden, note: hidden, more: hidden };
}

/** The "…" button is only shown when the layout actually hides something. */
function idleMoreButton(input: PillsLayoutInput): PillStyle {
  return input.hasGroup || input.hasNotes ? { display: "inline-flex", maxWidth: "none" } : hidden;
}
