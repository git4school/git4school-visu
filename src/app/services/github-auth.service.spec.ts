import { TestBed } from "@angular/core/testing";
import { HttpClient } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { Router } from "@angular/router";
import * as firebase from "firebase/app";
import { TokenStorageService } from "@services/token-storage.service";
import { GithubAuthService } from "./github-auth.service";
import { ToastService } from "./toast.service";

describe("GithubAuthService", () => {
  let service: GithubAuthService;
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;
  let toastSpy: jasmine.SpyObj<ToastService>;
  let mockFirebaseAuth: any;

  const clearAuthKeys = () => {
    sessionStorage.clear();
    localStorage.clear();
  };

  beforeEach(() => {
    clearAuthKeys();
    routerSpy = jasmine.createSpyObj("Router", ["navigate"]);
    toastSpy = jasmine.createSpyObj("ToastService", ["error", "success"]);

    mockFirebaseAuth = {
      onAuthStateChanged: jasmine.createSpy("onAuthStateChanged"),
      signOut: jasmine.createSpy("signOut").and.returnValue(Promise.resolve()),
      signInWithPopup: jasmine.createSpy("signInWithPopup"),
      setPersistence: jasmine.createSpy("setPersistence").and.returnValue(Promise.resolve()),
    };

    spyOn(firebase, "auth").and.returnValue(mockFirebaseAuth);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [GithubAuthService, { provide: Router, useValue: routerSpy }, { provide: ToastService, useValue: toastSpy }],
    });

    service = TestBed.inject(GithubAuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    if (httpMock) {
      httpMock.verify();
    }
    clearAuthKeys();
  });

  it("should be created and report isSignedIn based on token", () => {
    expect(service).toBeTruthy();
    expect(service.isSignedIn()).toBeFalse();

    service.token = "test-token";
    expect(service.isSignedIn()).toBeTrue();
  });

  it("should return account when signed in and null when signed out", () => {
    service.token = null;
    expect(service.getAccount()).toBeNull();

    service.token = "valid-token";
    service.username = "test-user";
    service.avatarUrl = "https://avatar.com/test.png";

    const account = service.getAccount();
    expect(account).not.toBeNull();
    expect(account?.provider).toBe("github");
    expect(account?.username).toBe("test-user");
    expect(account?.avatarUrl).toBe("https://avatar.com/test.png");
    expect(account?.instanceHost).toBe("github.com");
  });

  it("should generate profile URL correctly", () => {
    service.username = "octocat";
    expect(service.getProfileUrl()).toBe("https://github.com/octocat");
    expect(service.getProfileUrl("custom-user")).toBe("https://github.com/custom-user");
  });

  it("should reset state and clear storage on signOut", async () => {
    localStorage.setItem("dev_github_token", "old-dev-token");
    service.token = "active-token";
    service.username = "cached-user";

    let lastEmittedState: any = null;
    const sub = service.authChange$.subscribe((state) => {
      lastEmittedState = state;
    });

    await service.signOut();

    expect(service.token).toBeNull();
    expect(service.username).toBeNull();
    expect(service.avatarUrl).toBeNull();
    expect(service.displayName).toBeNull();
    expect(routerSpy.navigate).toHaveBeenCalledWith(["/"]);
    expect(localStorage.getItem("dev_github_token")).toBeNull();
    expect(lastEmittedState.isSignedIn).toBeFalse();

    sub.unsubscribe();
  });

  it("should fetch GitHub user profile via HTTP and update state", async () => {
    service.token = "gh-valid-token";

    const fetchPromise = service.fetchUserProfile();

    const req = httpMock.expectOne("https://api.github.com/user");
    expect(req.request.method).toBe("GET");
    expect(req.request.headers.get("Authorization")).toBe("token gh-valid-token");

    req.flush({
      login: "mika-dev",
      avatar_url: "https://avatars.githubusercontent.com/u/123",
      name: "Mikael",
    });

    await fetchPromise;

    expect(service.username).toBe("mika-dev");
    expect(service.avatarUrl).toBe("https://avatars.githubusercontent.com/u/123");
    expect(service.displayName).toBe("Mikael");
  });

  it("should configure firebase persistence according to rememberMe parameter", async () => {
    mockFirebaseAuth.signInWithPopup.and.returnValue(
      Promise.resolve({
        credential: { accessToken: "gho_test_123" },
        additionalUserInfo: { username: "octocat" },
        user: { photoURL: "https://avatar.png", displayName: "Octocat" },
      }),
    );

    await service.signIn(false);
    expect(mockFirebaseAuth.setPersistence).toHaveBeenCalledWith(firebase.auth.Auth.Persistence.SESSION);
    expect(service.token).toBe("gho_test_123");

    await service.signIn(true);
    expect(mockFirebaseAuth.setPersistence).toHaveBeenCalledWith(firebase.auth.Auth.Persistence.LOCAL);
  });

  it("should restore session from TokenStorageService on creation", () => {
    const tokenStorageService = TestBed.inject(TokenStorageService);
    tokenStorageService.saveToken("github", "gho_saved_token", false);
    tokenStorageService.saveUserData(
      "github",
      { username: "restored-user", avatarUrl: "https://avatar.url/img.png", displayName: "Restored" },
      false,
    );

    const newService = new GithubAuthService(routerSpy, TestBed.inject(HttpClient), toastSpy, tokenStorageService);
    httpMock.expectOne("https://api.github.com/rate_limit").flush({});

    expect(newService.isSignedIn()).toBeTrue();
    expect(newService.token).toBe("gho_saved_token");
    expect(newService.username).toBe("restored-user");
    expect(newService.avatarUrl).toBe("https://avatar.url/img.png");
    expect(newService.displayName).toBe("Restored");
  });
});
