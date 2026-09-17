import { TestBed } from "@angular/core/testing";
import { AccountsService } from "./accounts.service";
import { GithubAuthService, AuthState } from "./github-auth.service";
import { GitlabAuthService, GitlabAuthState } from "./gitlab-auth.service";
import { BehaviorSubject } from "rxjs";

describe("AccountsService", () => {
  let service: AccountsService;
  let authChangeMock$: BehaviorSubject<AuthState>;
  let gitlabAuthChangeMock$: BehaviorSubject<GitlabAuthState>;
  let githubAuthServiceSpy: jasmine.SpyObj<GithubAuthService>;
  let gitlabAuthServiceSpy: jasmine.SpyObj<GitlabAuthService>;

  beforeEach(() => {
    authChangeMock$ = new BehaviorSubject<AuthState>({
      isSignedIn: false,
      token: null,
      username: null,
      avatarUrl: null,
      displayName: null,
    });

    gitlabAuthChangeMock$ = new BehaviorSubject<GitlabAuthState>({
      isSignedIn: false,
      token: null,
      user: null,
    });

    githubAuthServiceSpy = {
      provider: "github",
      name: "GitHub",
      instanceHost: "github.com",
      signOut: jasmine.createSpy("signOut"),
      isSignedIn: jasmine.createSpy("isSignedIn").and.returnValue(false),
      getAccount: jasmine.createSpy("getAccount").and.returnValue(null),
      getProfileUrl: jasmine.createSpy("getProfileUrl").and.callFake((u?: string) => `https://github.com/${u || ""}`),
      authChange$: authChangeMock$.asObservable(),
      token: null,
      username: null,
      avatarUrl: null,
      displayName: null,
    } as any;

    gitlabAuthServiceSpy = {
      provider: "gitlab",
      name: "GitLab",
      instanceHost: "gitlab.com",
      signOut: jasmine.createSpy("signOut"),
      isSignedIn: jasmine.createSpy("isSignedIn").and.returnValue(false),
      getAccount: jasmine.createSpy("getAccount").and.returnValue(null),
      getProfileUrl: jasmine.createSpy("getProfileUrl").and.callFake((u?: string) => `https://gitlab.com/${u || ""}`),
      authChange$: gitlabAuthChangeMock$.asObservable(),
      token: null,
      currentUser: null,
    } as any;

    TestBed.configureTestingModule({
      providers: [
        AccountsService,
        { provide: GithubAuthService, useValue: githubAuthServiceSpy },
        { provide: GitlabAuthService, useValue: gitlabAuthServiceSpy },
      ],
    });

    service = TestBed.inject(AccountsService);
  });

  it("should be created with empty accounts when not signed in", (done) => {
    expect(service).toBeTruthy();
    expect(service.isEmpty()).toBeTrue();

    service.accounts$.subscribe((accounts) => {
      expect(accounts.length).toBe(0);
      done();
    });
  });

  it("should emit GitHub account when user is signed in", (done) => {
    githubAuthServiceSpy.isSignedIn.and.returnValue(true);
    githubAuthServiceSpy.getAccount.and.returnValue({
      id: "acc-github-real",
      provider: "github",
      instanceHost: "github.com",
      username: "octocat",
      avatarUrl: "https://example.com/avatar.png",
      isCurrent: true,
    });

    authChangeMock$.next({
      isSignedIn: true,
      token: "fake-token",
      username: "octocat",
      avatarUrl: "https://example.com/avatar.png",
      displayName: "The Octocat",
    });

    service.accounts$.subscribe((accounts) => {
      if (accounts.length > 0) {
        expect(accounts.length).toBe(1);
        expect(accounts[0].username).toBe("octocat");
        expect(accounts[0].provider).toBe("github");
        expect(accounts[0].instanceHost).toBe("github.com");
        expect(service.isEmpty()).toBeFalse();
        done();
      }
    });
  });

  it("should generate correct profile URLs", () => {
    expect(service.getProfileUrl(null as any)).toBe("#");
    expect(service.getProfileUrl({} as any)).toBe("#");

    expect(
      service.getProfileUrl({
        id: "1",
        username: "johndoe",
        provider: "github",
        instanceHost: "github.com",
      }),
    ).toBe("https://github.com/johndoe");

    expect(
      service.getProfileUrl({
        id: "2",
        username: "gitlabuser",
        provider: "gitlab",
        instanceHost: "https://gitlab.example.org/",
      }),
    ).toBe("https://gitlab.example.org/gitlabuser");
  });

  it("should call githubAuthService.signOut when disconnecting real github account", () => {
    githubAuthServiceSpy.isSignedIn.and.returnValue(true);
    githubAuthServiceSpy.getAccount.and.returnValue({
      id: "acc-github-real",
      provider: "github",
      instanceHost: "github.com",
      username: "octocat",
      avatarUrl: null,
      isCurrent: true,
    });

    authChangeMock$.next({
      isSignedIn: true,
      token: "fake-token",
      username: "octocat",
      avatarUrl: null,
      displayName: "Octocat",
    });

    service.disconnectAccount("acc-github-real");
    expect(githubAuthServiceSpy.signOut).toHaveBeenCalled();
  });

  it("should emit GitLab account when GitLab user is signed in", (done) => {
    gitlabAuthServiceSpy.isSignedIn.and.returnValue(true);
    gitlabAuthServiceSpy.getAccount.and.returnValue({
      id: "acc-gitlab-cloud",
      provider: "gitlab",
      instanceHost: "gitlab.com",
      username: "tanuki",
      avatarUrl: "https://gitlab.com/avatar.png",
      isCurrent: false,
    });

    gitlabAuthChangeMock$.next({
      isSignedIn: true,
      token: "gitlab-token-123",
      user: {
        id: 42,
        username: "tanuki",
        name: "Tanuki User",
        avatar_url: "https://gitlab.com/avatar.png",
        web_url: "https://gitlab.com/tanuki",
      },
    });

    service.accounts$.subscribe((accounts) => {
      const gitlabAcc = accounts.find((a) => a.provider === "gitlab");
      if (gitlabAcc) {
        expect(gitlabAcc.username).toBe("tanuki");
        expect(gitlabAcc.provider).toBe("gitlab");
        expect(gitlabAcc.instanceHost).toBe("gitlab.com");
        expect(service.isGitlabConnected).toBeTrue();
        done();
      }
    });
  });

  it("should call gitlabAuthService.signOut when disconnecting gitlab account", () => {
    gitlabAuthServiceSpy.isSignedIn.and.returnValue(true);
    gitlabAuthServiceSpy.getAccount.and.returnValue({
      id: "acc-gitlab-cloud",
      provider: "gitlab",
      instanceHost: "gitlab.com",
      username: "tanuki",
      avatarUrl: null,
      isCurrent: false,
    });

    gitlabAuthChangeMock$.next({
      isSignedIn: true,
      token: "gitlab-token-123",
      user: {
        id: 42,
        username: "tanuki",
        name: "Tanuki User",
        avatar_url: null,
        web_url: "https://gitlab.com/tanuki",
      },
    });

    service.disconnectAccount("acc-gitlab-cloud");
    expect(gitlabAuthServiceSpy.signOut).toHaveBeenCalled();
  });

  it("should return correct status for hasAccount", () => {
    githubAuthServiceSpy.isSignedIn.and.returnValue(true);
    gitlabAuthServiceSpy.isSignedIn.and.returnValue(false);

    expect(service.hasAccount("github")).toBeTrue();
    expect(service.hasAccount("gitlab")).toBeFalse();
  });

  it("should return data service if registered", () => {
    const fakeGithubData = { provider: "github" } as any;
    const fakeGitlabData = { provider: "gitlab" } as any;
    const customService = new AccountsService(githubAuthServiceSpy, gitlabAuthServiceSpy, fakeGithubData, fakeGitlabData);

    expect(customService.getDataService("github")).toBe(fakeGithubData);
    expect(customService.getDataService("gitlab")).toBe(fakeGitlabData);
  });
});
