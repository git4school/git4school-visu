import { choosePillsLayout, PillsLayoutInput } from "./session-pills-layout.util";

/**
 * Seuils de référence pour displayNameLength=10, groupNameLength=5, avec groupe et notes :
 * tout = 187 · nom+groupe+"…" = 183 · nom+groupe tronqué+"…" = 161 · nom+"…" = 119 ·
 * nom tronqué+"…" = 66 · nom seul = 55.
 */
describe("choosePillsLayout", () => {
  const full: PillsLayoutInput = {
    availableWidth: 0,
    displayNameLength: 10,
    groupNameLength: 5,
    hasGroup: true,
    hasNotes: true,
  };
  const layout = (availableWidth: number, overrides: Partial<PillsLayoutInput> = {}) =>
    choosePillsLayout({ ...full, availableWidth, ...overrides });

  it("should display everything when it fits", () => {
    const result = layout(187);
    expect(result.name).toEqual({ display: "inline-flex", maxWidth: "none" });
    expect(result.group).toEqual({ display: "inline-flex", maxWidth: "none" });
    expect(result.note.display).toBe("inline-flex");
    expect(result.more.display).toBe("none");
  });

  it("should drop the note first, signalling it with the more button", () => {
    const result = layout(183);
    expect(result.name.maxWidth).toBe("none");
    expect(result.group.maxWidth).toBe("none");
    expect(result.note.display).toBe("none");
    expect(result.more.display).toBe("inline-flex");
  });

  it("should truncate the group while keeping the name full", () => {
    const result = layout(161);
    expect(result.name).toEqual({ display: "inline-flex", maxWidth: "none" });
    /* available - nom - "…" - gap - padding = 161 - 91 - 20 - 4 - 8 */
    expect(result.group).toEqual({ display: "inline-flex", maxWidth: 38 });
    expect(result.note.display).toBe("none");
    expect(result.more.display).toBe("inline-flex");
  });

  it("should never truncate below the readable minimum", () => {
    /* Le seuil du cas tronqué garantit déjà 38px : la borne basse est une garde défensive. */
    expect(layout(161).group.maxWidth).toBe(38);
    expect(layout(182).group.maxWidth).toBe(59);
  });

  it("should drop the group when the name no longer fits next to it", () => {
    const result = layout(119);
    expect(result.name).toEqual({ display: "inline-flex", maxWidth: "none" });
    expect(result.group.display).toBe("none");
    expect(result.note.display).toBe("none");
    expect(result.more.display).toBe("inline-flex");
  });

  it("should truncate the name and keep the more button", () => {
    const result = layout(100);
    /* available - "…" - padding = 100 - 20 - 8 */
    expect(result.name).toEqual({ display: "inline-flex", maxWidth: 72 });
    expect(result.group.display).toBe("none");
    expect(result.more.display).toBe("inline-flex");
  });

  it("should keep only a narrow name pill below the more-button threshold", () => {
    const result = layout(60);
    expect(result.name).toEqual({ display: "inline-flex", maxWidth: 54 });
    expect(result.more.display).toBe("none");
    expect(result.note.display).toBe("none");
  });

  it("should hide every pill when the band is too narrow", () => {
    const result = layout(54);
    expect(result).toEqual({
      name: { display: "none", maxWidth: "none" },
      group: { display: "none", maxWidth: "none" },
      note: { display: "none", maxWidth: "none" },
      more: { display: "none", maxWidth: "none" },
    });
  });

  it("should not show the more button when nothing is hidden", () => {
    const result = layout(200, { hasGroup: false, hasNotes: false });
    expect(result.name.display).toBe("inline-flex");
    expect(result.group.display).toBe("none");
    expect(result.more.display).toBe("none");
  });

  it("should skip the group cases without a group", () => {
    /* Sans groupe ni note : tout = 99, seuil du nom tronqué = 46. */
    const result = layout(80, { hasGroup: false, hasNotes: false });
    expect(result.name).toEqual({ display: "inline-flex", maxWidth: 72 });
    expect(result.more.display).toBe("none");
    expect(layout(98, { hasGroup: false, hasNotes: false }).name.maxWidth).toBe(90);
    expect(layout(45, { hasGroup: false, hasNotes: false }).name.display).toBe("none");
  });

  it("should keep the note visible without a group", () => {
    const result = layout(200, { hasGroup: false });
    expect(result.note.display).toBe("inline-flex");
    expect(result.more.display).toBe("none");
  });
});
