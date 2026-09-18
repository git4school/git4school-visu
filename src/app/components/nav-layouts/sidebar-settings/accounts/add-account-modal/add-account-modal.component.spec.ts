import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormsModule } from "@angular/forms";
import { TranslateModule } from "@ngx-translate/core";
import { BehaviorSubject } from "rxjs";
import { AddAccountModalComponent } from "./add-account-modal.component";
import { GithubAuthService, AuthState } from "@services/github-auth.service";
import { GitlabAuthService } from "@services/gitlab-auth.service";
import { GitlabCustomAuthService } from "@services/gitlab-custom-auth.service";
import { AccountsService } from "@services/accounts.service";
import { DevFlagsService } from "@services/dev-flags.service";
import { CustomModalRef } from "@shared/ui/custom-modal/custom-modal-ref";
import { SharedUiModule } from "@shared/ui/shared-ui.module";

describe("AddAccountModalComponent", () => {
  let component: AddAccountModalComponent;
  let fixture: ComponentFixture<AddAccountModalComponent>;
  let githubAuthSpy: jasmine.SpyObj<GithubAuthService>;
  let gitlabAuthSpy: jasmine.SpyObj<GitlabAuthService>;
  let gitlabCustomAuthSpy: jasmine.SpyObj<GitlabCustomAuthService>;
  let accountsServiceSpy: jasmine.SpyObj<AccountsService>;
  let modalRefSpy: jasmine.SpyObj<CustomModalRef>;
  let cloudFlag$: BehaviorSubject<boolean>;
  let customFlag$: BehaviorSubject<boolean>;

  beforeEach(async () => {
    cloudFlag$ = new BehaviorSubject<boolean>(false);
    customFlag$ = new BehaviorSubject<boolean>(false);

    githubAuthSpy = jasmine.createSpyObj("GithubAuthService", ["signIn", "signOut", "isSignedIn", "getAccount", "getProfileUrl"], {
      provider: "github",
      name: "GitHub",
      instanceHost: "github.com",
      token: "mock-token",
      username: "testuser",
      avatarUrl: "https://example.com/avatar.jpg",
      authChange$: new BehaviorSubject<AuthState>({
        isSignedIn: true,
        token: "mock-token",
        username: "testuser",
        avatarUrl: "https://example.com/avatar.jpg",
        displayName: "Test User",
      }).asObservable(),
    });
    githubAuthSpy.isSignedIn.and.returnValue(true);
    githubAuthSpy.getAccount.and.returnValue({
      id: "acc-github-real",
      provider: "github",
      instanceHost: "github.com",
      username: "testuser",
      avatarUrl: "https://example.com/avatar.jpg",
      isCurrent: true,
    });
    githubAuthSpy.getProfileUrl.and.returnValue("https://github.com/testuser");

    gitlabAuthSpy = jasmine.createSpyObj(
      "GitlabAuthService",
      ["signIn", "loginWithPopup", "signOut", "isSignedIn", "getAccount", "getProfileUrl"],
      {
        provider: "gitlab",
        name: "GitLab",
        instanceHost: "gitlab.com",
        token: null,
        currentUser: null,
        authChange$: new BehaviorSubject({ isSignedIn: false, token: null, user: null }).asObservable(),
      },
    );
    gitlabAuthSpy.isSignedIn.and.returnValue(false);
    gitlabAuthSpy.getAccount.and.returnValue(null);
    gitlabAuthSpy.getProfileUrl.and.returnValue("https://gitlab.com");

    gitlabCustomAuthSpy = jasmine.createSpyObj("GitlabCustomAuthService", [
      "getAccounts",
      "getAccount",
      "getProfileUrl",
      "connectInstance",
      "disconnectInstance",
    ]);
    gitlabCustomAuthSpy.getAccounts.and.returnValue([]);
    gitlabCustomAuthSpy.getAccount.and.returnValue(null);
    gitlabCustomAuthSpy.getProfileUrl.and.returnValue("https://gitlab.example.com");

    modalRefSpy = jasmine.createSpyObj("CustomModalRef", ["close"]);

    accountsServiceSpy = jasmine.createSpyObj("AccountsService", ["getProvider", "disconnectAccount", "getProfileUrl"], {
      isGithubConnected: true,
      isGitlabConnected: false,
    });
    (accountsServiceSpy as any).gitlabCustomAuthService = gitlabCustomAuthSpy;
    accountsServiceSpy.getProvider.and.callFake((type: string) => {
      if (type === "github") return githubAuthSpy;
      if (type === "gitlab") return gitlabAuthSpy;
      return undefined;
    });

    const devFlagsSpy = {
      gitlabCloudEnabled: true,
      gitlabCustomEnabled: false,
      gitlabCloudEnabled$: cloudFlag$.asObservable(),
      gitlabCustomEnabled$: customFlag$.asObservable(),
    };

    await TestBed.configureTestingModule({
      declarations: [AddAccountModalComponent],
      imports: [FormsModule, SharedUiModule, TranslateModule.forRoot()],
      providers: [
        { provide: AccountsService, useValue: accountsServiceSpy },
        { provide: CustomModalRef, useValue: modalRefSpy },
        { provide: DevFlagsService, useValue: devFlagsSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddAccountModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create the component and default to github", () => {
    expect(component).toBeTruthy();
    expect(component.selectedPlatform).toBe("github");
    expect(component.isGithubConnected).toBeTrue();
  });

  it("should allow gitlab-cloud and guard gitlab-custom when dev flags are disabled", () => {
    const devFlags = TestBed.inject(DevFlagsService);

    component.selectPlatform("gitlab-cloud");
    expect(component.selectedPlatform).toBe("gitlab-cloud");

    component.selectPlatform("gitlab-custom");
    expect(component.selectedPlatform).toBe("gitlab-cloud");

    (devFlags as any).gitlabCustomEnabled = true;
    component.selectPlatform("gitlab-custom");
    expect(component.selectedPlatform).toBe("gitlab-custom");
  });

  it("should handle the two-step disconnect confirmation flow", () => {
    expect(component.isConfirmingDisconnect).toBeFalse();

    component.onDisconnectClick();
    expect(component.isConfirmingDisconnect).toBeTrue();
    expect(githubAuthSpy.signOut).not.toHaveBeenCalled();

    component.onDisconnectClick();
    expect(githubAuthSpy.signOut).toHaveBeenCalled();
    expect(component.isConfirmingDisconnect).toBeFalse();
  });

  it("should cancel confirmation on cancel click or escape key", () => {
    component.onDisconnectClick();
    expect(component.isConfirmingDisconnect).toBeTrue();

    component.cancelConfirmDisconnect();
    expect(component.isConfirmingDisconnect).toBeFalse();

    component.onDisconnectClick();
    expect(component.isConfirmingDisconnect).toBeTrue();

    const escapeEvent = new KeyboardEvent("keydown", { key: "Escape" });
    component.onEscape(escapeEvent);
    expect(component.isConfirmingDisconnect).toBeFalse();
  });

  it("should return correct platform auth type key for badges", () => {
    component.selectedPlatform = "github";
    expect(component.platformAuthTypeKey).toBe("ACCOUNTS.AUTH_TYPE_OAUTH");

    component.selectedPlatform = "gitlab-cloud";
    expect(component.platformAuthTypeKey).toBe("ACCOUNTS.AUTH_TYPE_OAUTH_PKCE");

    component.selectedPlatform = "gitlab-custom";
    expect(component.platformAuthTypeKey).toBe("ACCOUNTS.AUTH_TYPE_PAT");
  });

  it("should default rememberMe to false and pass it to provider.signIn", async () => {
    expect(component.rememberMe).toBeFalse();

    component.selectedPlatform = "gitlab-cloud";
    gitlabAuthSpy.signIn.and.returnValue(
      Promise.resolve({
        id: "acc-gitlab-cloud",
        provider: "gitlab",
        instanceHost: "gitlab.com",
        username: "testuser",
        avatarUrl: null,
        isCurrent: false,
      }),
    );

    component.rememberMe = true;
    await component.submitConnect();

    expect(gitlabAuthSpy.signIn).toHaveBeenCalledWith(true);
    expect(modalRefSpy.close).toHaveBeenCalled();
  });

  it("should connect custom instance with PAT", async () => {
    const devFlags = TestBed.inject(DevFlagsService);
    (devFlags as any).gitlabCustomEnabled = true;

    component.selectPlatform("gitlab-custom");
    component.gitlabInstanceUrl = "https://gitlab.univ-tlse3.fr";
    component.gitlabInstanceAlias = "UT3";
    component.gitlabToken = "glpat-test-123";
    component.rememberMe = true;

    gitlabCustomAuthSpy.connectInstance.and.returnValue(
      Promise.resolve({
        id: "acc-gitlab-gitlab.univ-tlse3.fr",
        provider: "gitlab",
        instanceHost: "gitlab.univ-tlse3.fr",
        instanceName: "UT3",
        username: "prof.turing",
        avatarUrl: null,
        isCurrent: false,
        authType: "pat",
      }),
    );

    await component.submitGitlabCustom();

    expect(gitlabCustomAuthSpy.connectInstance).toHaveBeenCalledWith("https://gitlab.univ-tlse3.fr", "glpat-test-123", "UT3", true);
    expect(modalRefSpy.close).toHaveBeenCalled();
  });

  it("should toggle custom dropdown and select custom instance", () => {
    gitlabCustomAuthSpy.getAccounts.and.returnValue([
      {
        id: "acc-1",
        provider: "gitlab",
        instanceHost: "gitlab.univ-tlse3.fr",
        instanceName: "UT3",
        username: "prof.turing",
        avatarUrl: null,
        isCurrent: true,
      },
    ]);

    expect(component.isCustomDropdownOpen).toBeFalse();
    const event = new MouseEvent("click");
    component.onCustomCardClick(event);
    expect(component.selectedPlatform).toBe("gitlab-custom");
    expect(component.isCustomDropdownOpen).toBeTrue();

    component.selectCustomInstance("gitlab.univ-tlse3.fr");
    expect(component.selectedCustomInstanceHost).toBe("gitlab.univ-tlse3.fr");
    expect(component.isCustomDropdownOpen).toBeFalse();
    expect(component.showAddCustomInstanceForm).toBeFalse();
  });
});
