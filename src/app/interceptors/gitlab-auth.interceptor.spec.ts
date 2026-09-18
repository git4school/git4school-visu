import { TestBed } from "@angular/core/testing";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { HTTP_INTERCEPTORS, HttpClient } from "@angular/common/http";
import { GitlabAuthInterceptor } from "./gitlab-auth.interceptor";
import { GitlabAuthService } from "@services/gitlab-auth.service";

describe("GitlabAuthInterceptor", () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let gitlabAuthServiceSpy: jasmine.SpyObj<GitlabAuthService>;

  beforeEach(() => {
    gitlabAuthServiceSpy = jasmine.createSpyObj<GitlabAuthService>(
      "GitlabAuthService",
      ["ensureValidToken", "refreshAccessToken", "isSignedIn"],
      { instanceHost: "gitlab.com" },
    );

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: GitlabAuthService, useValue: gitlabAuthServiceSpy },
        {
          provide: HTTP_INTERCEPTORS,
          useClass: GitlabAuthInterceptor,
          multi: true,
        },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it("should not intercept non-GitLab requests", () => {
    httpClient.get("/assets/i18n/fr.json").subscribe();

    const req = httpMock.expectOne("/assets/i18n/fr.json");
    expect(req.request.headers.has("Authorization")).toBeFalse();
    expect(gitlabAuthServiceSpy.ensureValidToken).not.toHaveBeenCalled();
    req.flush({});
  });

  it("should not intercept /oauth/token requests to prevent recursive loop", () => {
    httpClient.post("https://gitlab.com/oauth/token", {}).subscribe();

    const req = httpMock.expectOne("https://gitlab.com/oauth/token");
    expect(gitlabAuthServiceSpy.ensureValidToken).not.toHaveBeenCalled();
    req.flush({});
  });

  it("should attach Authorization header on GitLab API requests after ensuring valid token", async () => {
    gitlabAuthServiceSpy.ensureValidToken.and.returnValue(Promise.resolve("valid-token-123"));

    httpClient.get("https://gitlab.com/api/v4/projects").subscribe();

    // Wait for promise resolution from ensureValidToken
    await Promise.resolve();

    const req = httpMock.expectOne("https://gitlab.com/api/v4/projects");
    expect(req.request.headers.get("Authorization")).toBe("Bearer valid-token-123");
    req.flush([]);
  });

  it("should retry request on 401 response if refreshAccessToken succeeds", async () => {
    gitlabAuthServiceSpy.ensureValidToken.and.returnValue(Promise.resolve("stale-token"));
    gitlabAuthServiceSpy.isSignedIn.and.returnValue(true);
    gitlabAuthServiceSpy.refreshAccessToken.and.returnValue(Promise.resolve("fresh-token-456"));

    httpClient.get("https://gitlab.com/api/v4/projects").subscribe();

    await Promise.resolve();

    // Initial request fails with 401
    const req1 = httpMock.expectOne("https://gitlab.com/api/v4/projects");
    expect(req1.request.headers.get("Authorization")).toBe("Bearer stale-token");
    req1.flush({ message: "401 Unauthorized" }, { status: 401, statusText: "Unauthorized" });

    await Promise.resolve();

    // Retried request with new token
    const req2 = httpMock.expectOne("https://gitlab.com/api/v4/projects");
    expect(req2.request.headers.get("Authorization")).toBe("Bearer fresh-token-456");
    req2.flush([{ id: 1, name: "my-project" }]);
  });

  it("should forward 401 error if refreshAccessToken returns null", async () => {
    gitlabAuthServiceSpy.ensureValidToken.and.returnValue(Promise.resolve("stale-token"));
    gitlabAuthServiceSpy.isSignedIn.and.returnValue(true);
    gitlabAuthServiceSpy.refreshAccessToken.and.returnValue(Promise.resolve(null));

    let errorReceived: any = null;
    httpClient.get("https://gitlab.com/api/v4/projects").subscribe({
      error: (err) => {
        errorReceived = err;
      },
    });

    await Promise.resolve();

    const req = httpMock.expectOne("https://gitlab.com/api/v4/projects");
    req.flush({ message: "401 Unauthorized" }, { status: 401, statusText: "Unauthorized" });

    await Promise.resolve();

    expect(errorReceived).not.toBeNull();
    expect(errorReceived.status).toBe(401);
  });
});
