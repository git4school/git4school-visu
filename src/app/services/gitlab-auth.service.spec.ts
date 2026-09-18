import { TestBed } from "@angular/core/testing";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { GitlabAuthService } from "./gitlab-auth.service";

describe("GitlabAuthService", () => {
  let service: GitlabAuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [GitlabAuthService],
    });

    service = TestBed.inject(GitlabAuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("should be created with default unauthenticated state", () => {
    expect(service).toBeTruthy();
    expect(service.isSignedIn()).toBeFalse();
    expect(service.token).toBeNull();
    expect(service.currentUser).toBeNull();
  });

  it("should return null for getAccount when signed out, and Account when signed in", () => {
    expect(service.getAccount()).toBeNull();

    service.token = "token-xyz";
    service.currentUser = {
      id: 42,
      username: "tanuki",
      name: "Tanuki GitLab",
      avatar_url: "https://gitlab.com/tanuki.png",
      web_url: "https://gitlab.com/tanuki",
    };

    const account = service.getAccount();
    expect(account).not.toBeNull();
    expect(account?.provider).toBe("gitlab");
    expect(account?.username).toBe("tanuki");
    expect(account?.avatarUrl).toBe("https://gitlab.com/tanuki.png");
    expect(account?.instanceHost).toBe("gitlab.com");
  });

  it("should generate profile URL correctly", () => {
    service.currentUser = {
      id: 42,
      username: "tanuki",
      name: "Tanuki",
      avatar_url: "",
      web_url: "",
    };
    expect(service.getProfileUrl()).toBe("https://gitlab.com/tanuki");
    expect(service.getProfileUrl("another_user")).toBe("https://gitlab.com/another_user");
  });

  it("should reset state on signOut", (done) => {
    service.token = "fake-gitlab-token";
    service.currentUser = {
      id: 1,
      username: "john_doe",
      name: "John Doe",
      avatar_url: "https://gitlab.com/avatar.png",
      web_url: "https://gitlab.com/john_doe",
    };

    service.signOut();

    expect(service.isSignedIn()).toBeFalse();
    expect(service.token).toBeNull();
    expect(service.currentUser).toBeNull();

    service.authChange$.subscribe((state) => {
      expect(state.isSignedIn).toBeFalse();
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
      done();
    });
  });

  it("should generate code verifier and challenge with web crypto", async () => {
    const verifier = (service as any).generateCodeVerifier();
    expect(typeof verifier).toBe("string");
    expect(verifier.length).toBeGreaterThan(40);

    const challenge = await (service as any).generateCodeChallenge(verifier);
    expect(typeof challenge).toBe("string");
    expect(challenge.length).toBeGreaterThan(0);
    // Base64URL characters only
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("should restore session on init if valid token and user exist in storage", () => {
    const tokenStorage = TestBed.inject(GitlabAuthService)["tokenStorageService"];
    tokenStorage.saveToken("gitlab", "stored-gl-token", true);
    tokenStorage.saveUserData("gitlab", { id: 123, username: "stored_user", name: "Stored", avatar_url: "", web_url: "" }, true);

    const freshService = new GitlabAuthService(httpMock as any, tokenStorage);
    expect(freshService.isSignedIn()).toBeTrue();
    expect(freshService.token).toBe("stored-gl-token");
    expect(freshService.currentUser?.username).toBe("stored_user");
  });

  it("should successfully refresh access token and rotate refresh token", async () => {
    const tokenStorage = TestBed.inject(GitlabAuthService)["tokenStorageService"];
    tokenStorage.saveToken("gitlab", "old-access-token", true, 7200, "old-refresh-token");
    service.currentUser = { id: 1, username: "tanuki", name: "Tanuki", avatar_url: "", web_url: "" };

    const refreshPromise = service.refreshAccessToken();

    const req = httpMock.expectOne("https://gitlab.com/oauth/token");
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toContain("grant_type=refresh_token");
    expect(req.request.body).toContain("refresh_token=old-refresh-token");

    req.flush({
      access_token: "new-access-token",
      token_type: "Bearer",
      expires_in: 7200,
      refresh_token: "new-refresh-token",
    });

    const result = await refreshPromise;
    expect(result).toBe("new-access-token");
    expect(service.token).toBe("new-access-token");
    expect(tokenStorage.getToken("gitlab")).toBe("new-access-token");
    expect(tokenStorage.getRefreshToken("gitlab")).toBe("new-refresh-token");
  });

  it("should deduplicate concurrent refresh calls into a single HTTP request (mutex)", async () => {
    const tokenStorage = TestBed.inject(GitlabAuthService)["tokenStorageService"];
    tokenStorage.saveToken("gitlab", "old-token", true, 7200, "initial-refresh-token");
    service.currentUser = { id: 1, username: "tanuki", name: "Tanuki", avatar_url: "", web_url: "" };

    // Fire 3 simultaneous refresh calls
    const promise1 = service.refreshAccessToken();
    const promise2 = service.refreshAccessToken();
    const promise3 = service.refreshAccessToken();

    // Exactly one HTTP request should be sent
    const req = httpMock.expectOne("https://gitlab.com/oauth/token");
    req.flush({
      access_token: "deduped-access-token",
      token_type: "Bearer",
      expires_in: 7200,
      refresh_token: "rotated-refresh-token",
    });

    const [res1, res2, res3] = await Promise.all([promise1, promise2, promise3]);
    expect(res1).toBe("deduped-access-token");
    expect(res2).toBe("deduped-access-token");
    expect(res3).toBe("deduped-access-token");
    expect(service.token).toBe("deduped-access-token");
  });

  it("should sign out when refresh token is invalid or revoked (invalid_grant)", async () => {
    const tokenStorage = TestBed.inject(GitlabAuthService)["tokenStorageService"];
    tokenStorage.saveToken("gitlab", "stale-access", true, 7200, "revoked-refresh");
    service.token = "stale-access";
    service.currentUser = { id: 1, username: "tanuki", name: "Tanuki", avatar_url: "", web_url: "" };

    const refreshPromise = service.refreshAccessToken();

    const req = httpMock.expectOne("https://gitlab.com/oauth/token");
    req.flush(
      { error: "invalid_grant", error_description: "The provided authorization grant is invalid, expired, or revoked" },
      { status: 400, statusText: "Bad Request" },
    );

    const result = await refreshPromise;
    expect(result).toBeNull();
    expect(service.isSignedIn()).toBeFalse();
    expect(service.token).toBeNull();
    expect(service.currentUser).toBeNull();
    expect(tokenStorage.getToken("gitlab")).toBeNull();
    expect(tokenStorage.getRefreshToken("gitlab")).toBeNull();
  });

  it("should ensure valid token without refresh if token is still valid and not expiring soon", async () => {
    const tokenStorage = TestBed.inject(GitlabAuthService)["tokenStorageService"];
    // Token valid for 2 hours (7200s)
    tokenStorage.saveToken("gitlab", "current-valid-token", true, 7200, "valid-refresh");
    service.token = "current-valid-token";
    service.currentUser = { id: 1, username: "tanuki", name: "Tanuki", avatar_url: "", web_url: "" };

    const token = await service.ensureValidToken();
    expect(token).toBe("current-valid-token");
    httpMock.expectNone("https://gitlab.com/oauth/token");
  });
});
