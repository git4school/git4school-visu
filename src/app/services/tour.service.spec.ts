import { TourService } from "./tour.service";

/**
 * Guards the tour inventory: 24 steps, i18n keys derived from the step key, and the
 * centered/targeted defaults. The service builds its steps through `driver()` without
 * driving them, so the DOM is never touched.
 */
describe("TourService", () => {
  let router: any;
  let service: TourService;

  const buildService = (url = "/home"): TourService => {
    router = { url, navigate: () => Promise.resolve(true) };
    return new TourService({ instant: (key: string) => `[${key}]` } as any, router);
  };

  const getSteps = (tourService: TourService): any[] => {
    tourService.startTour();
    return (tourService as any).driverObj.getConfig().steps;
  };

  it("should build the whole tour, in order", () => {
    service = buildService();
    const steps = getSteps(service);

    expect(steps.length).toBe(24);
    expect(steps[0].element).toBeUndefined();
    expect(steps[1].element).toBeUndefined();
    expect(steps[2].element).toBeUndefined();
    expect(steps[3].element).toBe("#tour-create-assignment-btn");
    expect(steps[23].element).toBe(".assignment-card:first-child .btn-icon-action.text-primary");
  });

  it("should translate each step from its key", () => {
    service = buildService();
    const steps = getSteps(service);

    expect(steps[0].popover.title).toBe("[TOUR.WELCOME_TITLE]");
    expect(steps[0].popover.description).toBe("[TOUR.WELCOME_DESC]");
    expect(steps[3].popover.title).toBe("[TOUR.CREATE_BTN_TITLE]");
    expect(steps[3].popover.description).toBe("[TOUR.CREATE_BTN_DESC]");
    expect(steps[23].popover.title).toBe("[TOUR.ACCESS_TITLE]");
  });

  it("should center steps without element and default the others to bottom/start", () => {
    service = buildService();
    const steps = getSteps(service);

    expect(steps[0].popover.align).toBe("center");
    expect(steps[0].popover.side).toBeUndefined();

    expect(steps[3].popover.side).toBe("bottom");
    expect(steps[3].popover.align).toBe("start");
  });

  it("should keep the side overrides of the tour", () => {
    service = buildService();
    const steps = getSteps(service);

    expect(steps[7].element).toBe("#tour-dates");
    expect(steps[7].popover.side).toBe("top");
    expect(steps[15].popover.side).toBe("left");
    expect(steps[17].popover.side).toBe("left");
    expect(steps[18].popover.side).toBe("top");
    expect(steps[19].popover.side).toBe("top");
    expect(steps[23].popover.side).toBe("left");
  });

  it("should only hide the next button on steps that wait for a user action", () => {
    service = buildService();
    const steps = getSteps(service);

    expect(steps[0].popover.onPopoverRender).toBeUndefined();
    expect(steps[3].popover.onPopoverRender).toBeDefined();
    expect(steps[4].popover.onPopoverRender).toBeDefined();
    expect(steps[5].popover.onPopoverRender).toBeDefined();
    expect(typeof steps[3].popover.onPopoverRender).toBe("function");
  });

  it("should mark the tour as seen when it starts", () => {
    service = buildService();
    service.startTour();

    expect(localStorage.getItem("hasSeenTour")).toBe("true");
  });

  it("should navigate to the home page before starting the tour from another view", async () => {
    const navigate = jasmine.createSpy("navigate").and.returnValue(Promise.resolve(true));
    service = buildService("/commits");
    (service as any).router.navigate = navigate;

    await service.startTour();

    expect(navigate).toHaveBeenCalledWith(["/home"]);
  });
});
