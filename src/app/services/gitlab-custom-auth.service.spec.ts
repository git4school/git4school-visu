import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { GitlabCustomAuthService } from "./gitlab-custom-auth.service";
import { TokenStorageService } from "./token-storage.service";

describe("GitlabCustomAuthService", () => {
  let service: GitlabCustomAuthService;
  let httpMock: HttpTestingController;
  let tokenStorageService: TokenStorageService;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [GitlabCustomAuthService, TokenStorageService],
    });

    service = TestBed.inject(GitlabCustomAuthService);
    httpMock = TestBed.inject(HttpTestingController);
    tokenStorageService = TestBed.inject(TokenStorageService);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("should normalize URLs accurately", () => {
    expect(service.normalizeUrl("gitlab.univ-tlse3.fr")).toEqual({
      cleanUrl: "https://gitlab.univ-tlse3.fr",
      host: "gitlab.univ-tlse3.fr",
    });

    expect(service.normalizeUrl("https://gitlab.irit.fr/sub/")).toEqual({
      cleanUrl: "https://gitlab.irit.fr",
      host: "gitlab.irit.fr",
    });

    expect(service.normalizeUrl("http://local-gitlab.dev:8080/")).toEqual({
      cleanUrl: "http://local-gitlab.dev:8080",
      host: "local-gitlab.dev",
    });
  });

  it("should successfully connect a custom instance and store token and user", async () => {
    const connectPromise = service.connectInstance("https://gitlab.univ-tlse3.fr", "glpat-test123", "UT3", true);

    const req = httpMock.expectOne("https://gitlab.univ-tlse3.fr/api/v4/user");
    expect(req.request.method).toBe("GET");
    expect(req.request.headers.get("PRIVATE-TOKEN")).toBe("glpat-test123");

    req.flush({
      id: 42,
      username: "prof.turing",
      name: "Alan Turing",
      avatar_url: "https://gitlab.univ-tlse3.fr/uploads/avatar.png",
      web_url: "https://gitlab.univ-tlse3.fr/prof.turing",
    });

    await Promise.resolve();

    const tokenReq = httpMock.expectOne("https://gitlab.univ-tlse3.fr/api/v4/personal_access_tokens/self");
    tokenReq.flush({ expires_at: "2026-12-31" });

    const account = await connectPromise;
    expect(account.username).toBe("prof.turing");
    expect(account.instanceHost).toBe("gitlab.univ-tlse3.fr");
    expect(account.instanceName).toBe("UT3");
    expect(account.authType).toBe("pat");

    expect(service.hasAccount("gitlab.univ-tlse3.fr")).toBeTrue();
    expect(service.getAccounts().length).toBe(1);

    const storedToken = tokenStorageService.getToken("gitlab", "gitlab.univ-tlse3.fr");
    expect(storedToken).toBe("glpat-test123");
  });

  it("should throw INVALID_HOST when attempting to connect gitlab.com as custom instance", async () => {
    await expectAsync(service.connectInstance("https://gitlab.com", "some_token")).toBeRejectedWithError("INVALID_HOST");
  });

  it("should throw INVALID_PAT when token verification returns 401", async () => {
    const connectPromise = service.connectInstance("https://gitlab.univ-tlse3.fr", "bad_token");

    const req = httpMock.expectOne("https://gitlab.univ-tlse3.fr/api/v4/user");
    req.flush({ message: "401 Unauthorized" }, { status: 401, statusText: "Unauthorized" });

    await expectAsync(connectPromise).toBeRejectedWithError("INVALID_PAT");
  });

  it("should throw SERVER_UNREACHABLE when network fails", async () => {
    const connectPromise = service.connectInstance("https://gitlab.down.org", "token");

    const req = httpMock.expectOne("https://gitlab.down.org/api/v4/user");
    req.error(new ErrorEvent("Network error"));

    await expectAsync(connectPromise).toBeRejectedWithError("SERVER_UNREACHABLE");
  });

  it("should disconnect an instance without affecting other instances", async () => {
    const p1 = service.connectInstance("https://gitlab.univ-tlse3.fr", "tok1", "UT3");
    httpMock.expectOne("https://gitlab.univ-tlse3.fr/api/v4/user").flush({
      id: 1,
      username: "user1",
      name: "User One",
      avatar_url: "",
      web_url: "",
    });
    await Promise.resolve();
    httpMock.expectOne("https://gitlab.univ-tlse3.fr/api/v4/personal_access_tokens/self").flush({});
    await p1;

    const p2 = service.connectInstance("https://gitlab.irit.fr", "tok2", "IRIT");
    httpMock.expectOne("https://gitlab.irit.fr/api/v4/user").flush({
      id: 2,
      username: "user2",
      name: "User Two",
      avatar_url: "",
      web_url: "",
    });
    await Promise.resolve();
    httpMock.expectOne("https://gitlab.irit.fr/api/v4/personal_access_tokens/self").flush({});
    await p2;

    expect(service.getAccounts().length).toBe(2);

    service.disconnectInstance("gitlab.univ-tlse3.fr");
    expect(service.getAccounts().length).toBe(1);
    expect(service.hasAccount("gitlab.univ-tlse3.fr")).toBeFalse();
    expect(service.hasAccount("gitlab.irit.fr")).toBeTrue();
    expect(tokenStorageService.getToken("gitlab", "gitlab.univ-tlse3.fr")).toBeNull();
    expect(tokenStorageService.getToken("gitlab", "gitlab.irit.fr")).toBe("tok2");
  });
});
