import { TestBed } from "@angular/core/testing";
import { TokenStorageService } from "./token-storage.service";

describe("TokenStorageService", () => {
  let service: TokenStorageService;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [TokenStorageService],
    });
    service = TestBed.inject(TokenStorageService);
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("should store token in sessionStorage when rememberMe is false", () => {
    service.saveToken("github", "gho_sample_token_123", false);

    expect(sessionStorage.getItem("g4s_auth_v1_github")).toBeTruthy();
    expect(localStorage.getItem("g4s_auth_v1_github")).toBeNull();

    // Verify raw token is NOT stored in plain text
    expect(sessionStorage.getItem("g4s_auth_v1_github")).not.toContain("gho_sample_token_123");

    const retrieved = service.getToken("github");
    expect(retrieved).toBe("gho_sample_token_123");
    expect(service.isRemembered("github")).toBeFalse();
  });

  it("should store token in localStorage when rememberMe is true", () => {
    service.saveToken("gitlab", "glpat_sample_token_456", true);

    expect(localStorage.getItem("g4s_auth_v1_gitlab")).toBeTruthy();
    expect(sessionStorage.getItem("g4s_auth_v1_gitlab")).toBeNull();

    // Verify raw token is NOT stored in plain text
    expect(localStorage.getItem("g4s_auth_v1_gitlab")).not.toContain("glpat_sample_token_456");

    const retrieved = service.getToken("gitlab");
    expect(retrieved).toBe("glpat_sample_token_456");
    expect(service.isRemembered("gitlab")).toBeTrue();
  });

  it("should prioritize active sessionStorage over localStorage if present", () => {
    service.saveToken("github", "remembered_token", true);
    const localData = localStorage.getItem("g4s_auth_v1_github") || "";
    sessionStorage.setItem("g4s_auth_v1_github", localData.replace(/true/, "false"));

    const retrieved = service.getToken("github");
    expect(retrieved).toBe("remembered_token");
  });

  it("should reject and clear expired tokens", () => {
    // Save token with negative expiresInSeconds (already expired)
    service.saveToken("gitlab", "expired_token", true, -10);

    const retrieved = service.getToken("gitlab");
    expect(retrieved).toBeNull();
    expect(localStorage.getItem("g4s_auth_v1_gitlab")).toBeNull();
  });

  it("should reject tampered data with invalid signature", () => {
    service.saveToken("github", "secure_token", false);

    const raw = sessionStorage.getItem("g4s_auth_v1_github") || "{}";
    const parsed = JSON.parse(raw);
    // Tamper with signature
    parsed.sig = "0000000000000000";
    sessionStorage.setItem("g4s_auth_v1_github", JSON.stringify(parsed));

    const retrieved = service.getToken("github");
    expect(retrieved).toBeNull();
  });

  it("should clear tokens and user data on clearAll", () => {
    service.saveToken("github", "token_to_clear", true);
    service.saveUserData("github", { username: "octocat" }, true);

    expect(service.getToken("github")).toBe("token_to_clear");
    expect(service.getUserData<{ username: string }>("github")?.username).toBe("octocat");

    service.clearAll("github");

    expect(service.getToken("github")).toBeNull();
    expect(service.getUserData("github")).toBeNull();
    expect(localStorage.getItem("g4s_auth_v1_github")).toBeNull();
    expect(localStorage.getItem("g4s_user_v1_github")).toBeNull();
  });
});
