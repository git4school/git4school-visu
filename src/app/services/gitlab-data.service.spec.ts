import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { TranslateService } from "@ngx-translate/core";
import { GitlabAuthService } from "./gitlab-auth.service";
import { GitlabDataService } from "./gitlab-data.service";

describe("GitlabDataService", () => {
  let service: GitlabDataService;
  let httpMock: HttpTestingController;
  let gitlabAuthServiceSpy: jasmine.SpyObj<GitlabAuthService>;
  let translateServiceSpy: jasmine.SpyObj<TranslateService>;

  beforeEach(() => {
    gitlabAuthServiceSpy = {
      token: "test-token-gitlab",
      instanceHost: "gitlab.com",
      isSignedIn: jasmine.createSpy("isSignedIn").and.returnValue(true),
    } as any;

    translateServiceSpy = {
      instant: jasmine.createSpy("instant").and.callFake((key: string) => key),
    } as any;

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        GitlabDataService,
        { provide: GitlabAuthService, useValue: gitlabAuthServiceSpy },
        { provide: TranslateService, useValue: translateServiceSpy },
      ],
    });

    service = TestBed.inject(GitlabDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it("should be created with provider gitlab", () => {
    expect(service).toBeTruthy();
    expect(service.provider).toBe("gitlab");
  });

  it("should verify user access by querying gitlab project endpoint", () => {
    service.verifyUserAccess("https://gitlab.com/univ/course/student-repo").subscribe((res) => {
      expect(res).toBeTruthy();
      expect(res.name).toBe("student-repo");
      expect(res.owner.avatar_url).toBe("https://example.com/avatar.png");
    });

    const encodedPath = encodeURIComponent("univ/course/student-repo");
    const req = httpMock.expectOne(`https://gitlab.com/api/v4/projects/${encodedPath}`);
    expect(req.request.method).toBe("GET");
    expect(req.request.headers.get("Authorization")).toBe("Bearer test-token-gitlab");
    req.flush({
      name: "student-repo",
      avatar_url: "https://example.com/avatar.png",
      namespace: { avatar_url: null },
    });
  });

  it("should support self-hosted GitLab instance URLs", () => {
    service.verifyUserAccess("https://gitlab.univ-nantes.fr/group/subgroup/project.git").subscribe((res) => {
      expect(res).toBeTruthy();
      expect(res.name).toBe("project");
    });

    const encodedPath = encodeURIComponent("group/subgroup/project");
    const req = httpMock.expectOne(`https://gitlab.univ-nantes.fr/api/v4/projects/${encodedPath}`);
    expect(req.request.method).toBe("GET");
    req.flush({ name: "project" });
  });

  it("should fetch authenticated user repositories with pagination", () => {
    service.getRepositoriesByAuthenticatedUser().subscribe((result) => {
      expect(result.completed).toBeTrue();
      expect(result.repositories.length).toBe(1);
      expect(result.repositories[0].name).toBe("group/my-repo");
      expect(result.repositories[0].provider).toBe("gitlab");
    });

    const req = httpMock.expectOne("https://gitlab.com/api/v4/projects?membership=true&order_by=created_at&sort=desc&per_page=100&page=1");
    expect(req.request.method).toBe("GET");
    req.flush(
      [
        {
          web_url: "https://gitlab.com/group/my-repo",
          path_with_namespace: "group/my-repo",
          name: "my-repo",
          description: "Test repo",
        },
      ],
      { headers: { "x-next-page": "" } },
    );
  });
});
