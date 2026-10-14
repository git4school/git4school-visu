import { computePopupPlacement } from "./popup-placement.util";

describe("popup-placement.util", () => {
  const base = {
    popupWidth: 350,
    popupHeight: 390,
    viewportWidth: 1400,
    viewportHeight: 900,
  };

  it("should open below when there is enough room", () => {
    const placement = computePopupPlacement({ ...base, triggerRect: { top: 100, left: 200, bottom: 140 } });
    expect(placement.dropUp).toBeFalse();
    expect(placement.alignRight).toBeFalse();
    /* Les offsets sont relatifs au déclencheur : bottom + 8. */
    expect(placement.top).toBe(48);
    expect(placement.left).toBe(0);
  });

  it("should open above when it does not fit below", () => {
    const placement = computePopupPlacement({ ...base, triggerRect: { top: 700, left: 200, bottom: 740 } });
    expect(placement.dropUp).toBeTrue();
    /* top - 8 - hauteur, relatif au déclencheur. */
    expect(placement.top).toBe(-398);
  });

  it("should clamp inside the viewport when it fits nowhere", () => {
    const placement = computePopupPlacement({
      ...base,
      popupHeight: 500,
      triggerRect: { top: 400, left: 200, bottom: 440 },
    });
    /* viewportHeight - popupHeight - margin = 388, soit 388 - 400 par rapport au déclencheur. */
    expect(placement.top).toBe(-12);
    expect(placement.dropUp).toBeFalse();
  });

  it("should keep the roomier side when it fits nowhere", () => {
    const placement = computePopupPlacement({
      ...base,
      popupHeight: 500,
      triggerRect: { top: 780, left: 200, bottom: 820 },
    });
    expect(placement.dropUp).toBeTrue();
  });

  it("should pin the popup to the top margin on a tiny viewport", () => {
    const placement = computePopupPlacement({
      ...base,
      viewportHeight: 400,
      triggerRect: { top: 100, left: 200, bottom: 140 },
    });
    expect(placement.top).toBe(-88); // margin 12 - top 100
  });

  it("should shift left when the popup would overflow the right edge", () => {
    const placement = computePopupPlacement({ ...base, triggerRect: { top: 100, left: 1200, bottom: 140 } });
    expect(placement.alignRight).toBeTrue();
    expect(placement.left).toBe(1400 - 350 - 12 - 1200);
  });

  it("should never place the popup before the left margin", () => {
    const placement = computePopupPlacement({
      ...base,
      popupWidth: 1400,
      triggerRect: { top: 100, left: 100, bottom: 140 },
    });
    expect(placement.left).toBe(12 - 100);
  });

  it("should honour a custom margin", () => {
    const placement = computePopupPlacement({
      ...base,
      margin: 40,
      viewportHeight: 400,
      triggerRect: { top: 100, left: 200, bottom: 140 },
    });
    expect(placement.top).toBe(40 - 100);
  });
});
