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
});
