import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { TranslateService } from "@ngx-translate/core";
import { GithubAuthService } from "./github-auth.service";
import { GithubDataService } from "./github-data.service";

describe("GithubDataService", () => {
  let service: GithubDataService;
  let httpMock: HttpTestingController;
  let githubAuthServiceSpy: jasmine.SpyObj<GithubAuthService>;
  let translateServiceSpy: jasmine.SpyObj<TranslateService>;

  beforeEach(() => {
    githubAuthServiceSpy = {
      token: "test-token-github",
      isSignedIn: jasmine.createSpy("isSignedIn").and.returnValue(true),
    } as any;

    translateServiceSpy = {
      instant: jasmine.createSpy("instant").and.callFake((key: string) => key),
    } as any;

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        GithubDataService,
        { provide: GithubAuthService, useValue: githubAuthServiceSpy },
        { provide: TranslateService, useValue: translateServiceSpy },
      ],
    });

    service = TestBed.inject(GithubDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it("should be created with provider github", () => {
    expect(service).toBeTruthy();
    expect(service.provider).toBe("github");
  });

  it("should verify user access by querying repository endpoint", () => {
    service.verifyUserAccess("https://github.com/octocat/Hello-World").subscribe((res) => {
      expect(res).toBeTruthy();
      expect(res.name).toBe("Hello-World");
    });

    const req = httpMock.expectOne("https://api.github.com/repos/octocat/Hello-World");
    expect(req.request.method).toBe("GET");
    expect(req.request.headers.get("Authorization")).toBe("token test-token-github");
    req.flush({ name: "Hello-World" });
  });

  it("should fetch user organizations with caching", () => {
    service.getUserOrganizations().subscribe((orgs) => {
      expect(orgs).toEqual(["my-org"]);
    });

    const req = httpMock.expectOne("https://api.github.com/graphql");
    expect(req.request.method).toBe("POST");
    req.flush({
      data: {
        viewer: {
          organizations: {
            nodes: [{ login: "my-org" }],
          },
        },
      },
    });

    // Second call should return cached without HTTP call
    service.getUserOrganizations().subscribe((orgs) => {
      expect(orgs).toEqual(["my-org"]);
    });
    httpMock.expectNone("https://api.github.com/graphql");
  });
});
