import { TestBed } from "@angular/core/testing";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { Router } from "@angular/router";
import * as firebase from "firebase/app";
import { AuthService } from "./auth.service";
import { ToastService } from "./toast.service";

describe("AuthService", () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;
  let toastSpy: jasmine.SpyObj<ToastService>;
  let mockFirebaseAuth: any;

  const clearAuthKeys = () => {
    ["github_username", "github_avatar", "github_name", "github_token"].forEach((key) => localStorage.removeItem(key));
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
      providers: [AuthService, { provide: Router, useValue: routerSpy }, { provide: ToastService, useValue: toastSpy }],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    if (httpMock) {
      httpMock.verify();
    }
    clearAuthKeys();
    localStorage.removeItem("dev_github_token");
  });

  it("should be created and report isSignedIn based on token", () => {
    expect(service).toBeTruthy();
    expect(service.isSignedIn()).toBeNull();

    service.token = "test-token";
    expect(service.isSignedIn()).toBe("test-token");
  });

  it("should reset state on signOut without removing dev_github_token from localStorage", async () => {
    localStorage.setItem("dev_github_token", "secret-dev-token");
    localStorage.setItem("github_username", "cached-user");
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

    // dev_github_token must NOT be removed from localStorage
    expect(localStorage.getItem("dev_github_token")).toBe("secret-dev-token");
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
});
