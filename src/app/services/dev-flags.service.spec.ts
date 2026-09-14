import { TestBed } from "@angular/core/testing";
import { DevFlagsService } from "./dev-flags.service";

describe("DevFlagsService", () => {
  let service: DevFlagsService;

  beforeEach(() => {
    localStorage.removeItem("git4school_dev_flags");
    TestBed.configureTestingModule({
      providers: [DevFlagsService],
    });
    service = TestBed.inject(DevFlagsService);
  });

  afterEach(() => {
    localStorage.removeItem("git4school_dev_flags");
  });

  it("should be created with default flags disabled", (done) => {
    expect(service).toBeTruthy();
    expect(service.gitlabCloudEnabled).toBeFalse();
    expect(service.gitlabCustomEnabled).toBeFalse();

    service.gitlabCloudEnabled$.subscribe((enabled) => {
      expect(enabled).toBeFalse();
      done();
    });
  });

  it("should toggle gitlabCloud flag and notify subscribers", (done) => {
    service.toggleGitlabCloud();
    expect(service.gitlabCloudEnabled).toBeTrue();

    service.gitlabCloudEnabled$.subscribe((enabled) => {
      expect(enabled).toBeTrue();
      done();
    });
  });

  it("should toggle gitlabCustom flag and notify subscribers", (done) => {
    service.toggleGitlabCustom();
    expect(service.gitlabCustomEnabled).toBeTrue();

    service.gitlabCustomEnabled$.subscribe((enabled) => {
      expect(enabled).toBeTrue();
      done();
    });
  });

  it("should reset flags to defaults", () => {
    service.toggleGitlabCloud(true);
    service.toggleGitlabCustom(true);
    expect(service.gitlabCloudEnabled).toBeTrue();
    expect(service.gitlabCustomEnabled).toBeTrue();

    service.resetFlags();
    expect(service.gitlabCloudEnabled).toBeFalse();
    expect(service.gitlabCustomEnabled).toBeFalse();
  });
});
