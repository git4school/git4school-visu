import { TestBed } from "@angular/core/testing";
import { environment } from "@environments/environment";
import { WhatsNewService } from "@services/whats-new.service";
import { CustomModalService } from "@shared/ui/custom-modal/custom-modal.service";
import { WHATS_NEW_RELEASES } from "@shared/ui/whats-new/whats-new.data";

describe("WhatsNewService", () => {
  let service: WhatsNewService;
  let openSpy: jasmine.Spy;

  const currentRelease = WHATS_NEW_RELEASES[0];
  const previousRelease = WHATS_NEW_RELEASES[1];

  beforeEach(() => {
    localStorage.removeItem(WhatsNewService.STORAGE_KEY);
    openSpy = jasmine.createSpy("open").and.callFake(() => ({
      componentInstance: {},
      result: Promise.resolve("close"),
    }));

    TestBed.configureTestingModule({
      providers: [
        WhatsNewService,
        {
          provide: CustomModalService,
          useValue: { open: openSpy },
        },
      ],
    });

    service = TestBed.inject(WhatsNewService);
  });

  afterEach(() => {
    localStorage.removeItem(WhatsNewService.STORAGE_KEY);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("should highlight the release matching the running version", () => {
    expect(service.getCurrentRelease()).toEqual(currentRelease);
  });

  it("should keep the older releases for the history panel", () => {
    const previousReleases = service.getPreviousReleases();
    expect(previousReleases).toContain(previousRelease);
    expect(previousReleases).not.toContain(currentRelease);
  });

  it("should show the modal on a first launch, without any stored version", () => {
    expect(service.shouldShow()).toBeTrue();
  });

  it("should not show the modal once the running version has been seen", () => {
    service.markAsSeen();

    expect(localStorage.getItem(WhatsNewService.STORAGE_KEY)).toBe(environment.version);
    expect(service.shouldShow()).toBeFalse();
  });

  it("should show the modal when the stored version is older", () => {
    localStorage.setItem(WhatsNewService.STORAGE_KEY, "2.0.0");

    expect(service.shouldShow()).toBeTrue();
  });

  it("should stay quiet when the stored version is newer, as after a rollback", () => {
    localStorage.setItem(WhatsNewService.STORAGE_KEY, "99.0.0");

    expect(service.shouldShow()).toBeFalse();
  });

  it("should treat an unreadable stored version as a first launch", () => {
    localStorage.setItem(WhatsNewService.STORAGE_KEY, "not-a-version");

    expect(service.shouldShow()).toBeTrue();
  });

  it("should stay quiet when the running version has no highlights", () => {
    spyOn(service, "getCurrentRelease").and.returnValue(undefined);

    expect(service.shouldShow()).toBeFalse();
  });

  it("should feed the modal and record the version as seen when it closes", async () => {
    const modalRef = service.open();

    expect(openSpy).toHaveBeenCalled();
    expect(modalRef.componentInstance.release).toEqual(currentRelease);
    expect(modalRef.componentInstance.previousReleases).toContain(previousRelease);

    await modalRef.result;
    await Promise.resolve();

    expect(localStorage.getItem(WhatsNewService.STORAGE_KEY)).toBe(environment.version);
  });

  it("should not open the modal when the running version has no highlights", () => {
    spyOn(service, "getCurrentRelease").and.returnValue(undefined);

    expect(service.open()).toBeNull();
    expect(openSpy).not.toHaveBeenCalled();
  });
});
