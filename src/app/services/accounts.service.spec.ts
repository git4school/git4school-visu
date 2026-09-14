import { TestBed } from "@angular/core/testing";
import { AccountsService } from "./accounts.service";
import { AuthService, AuthState } from "./auth.service";
import { BehaviorSubject } from "rxjs";

describe("AccountsService", () => {
  let service: AccountsService;
  let authChangeMock$: BehaviorSubject<AuthState>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authChangeMock$ = new BehaviorSubject<AuthState>({
      isSignedIn: false,
      token: null,
      username: null,
      avatarUrl: null,
      displayName: null,
    });

    authServiceSpy = {
      signOut: jasmine.createSpy("signOut"),
      isSignedIn: jasmine.createSpy("isSignedIn").and.returnValue(null),
      authChange$: authChangeMock$.asObservable(),
      token: null,
      username: null,
      avatarUrl: null,
      displayName: null,
    } as any;

    TestBed.configureTestingModule({
      providers: [AccountsService, { provide: AuthService, useValue: authServiceSpy }],
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
    (authServiceSpy as any).token = "fake-token";
    (authServiceSpy as any).username = "octocat";
    (authServiceSpy as any).avatarUrl = "https://example.com/avatar.png";
    authServiceSpy.isSignedIn.and.returnValue("fake-token");

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
        lastSync: "now",
      }),
    ).toBe("https://github.com/johndoe");

    expect(
      service.getProfileUrl({
        id: "2",
        username: "gitlabuser",
        provider: "gitlab",
        instanceHost: "https://gitlab.example.org/",
        lastSync: "now",
      }),
    ).toBe("https://gitlab.example.org/gitlabuser");
  });

  it("should call authService.signOut when disconnecting real github account", () => {
    (authServiceSpy as any).token = "fake-token";
    (authServiceSpy as any).username = "octocat";
    authServiceSpy.isSignedIn.and.returnValue("fake-token");

    authChangeMock$.next({
      isSignedIn: true,
      token: "fake-token",
      username: "octocat",
      avatarUrl: null,
      displayName: "Octocat",
    });

    service.disconnectAccount("acc-github-real");
    expect(authServiceSpy.signOut).toHaveBeenCalled();
  });
});
