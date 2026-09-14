import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormsModule } from "@angular/forms";
import { TranslateModule } from "@ngx-translate/core";
import { BehaviorSubject } from "rxjs";
import { AddAccountModalComponent } from "./add-account-modal.component";
import { AuthService, AuthState } from "@services/auth.service";
import { DevFlagsService } from "@services/dev-flags.service";
import { CustomModalRef } from "@shared/ui/custom-modal/custom-modal-ref";
import { SharedUiModule } from "@shared/ui/shared-ui.module";

describe("AddAccountModalComponent", () => {
  let component: AddAccountModalComponent;
  let fixture: ComponentFixture<AddAccountModalComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let modalRefSpy: jasmine.SpyObj<CustomModalRef>;
  let cloudFlag$: BehaviorSubject<boolean>;
  let customFlag$: BehaviorSubject<boolean>;

  beforeEach(async () => {
    cloudFlag$ = new BehaviorSubject<boolean>(false);
    customFlag$ = new BehaviorSubject<boolean>(false);

    authServiceSpy = jasmine.createSpyObj("AuthService", ["signIn", "signOut", "isSignedIn"], {
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
    authServiceSpy.isSignedIn.and.returnValue("mock-token");

    modalRefSpy = jasmine.createSpyObj("CustomModalRef", ["close"]);

    const devFlagsSpy = {
      gitlabCloudEnabled: false,
      gitlabCustomEnabled: false,
      gitlabCloudEnabled$: cloudFlag$.asObservable(),
      gitlabCustomEnabled$: customFlag$.asObservable(),
    };

    await TestBed.configureTestingModule({
      declarations: [AddAccountModalComponent],
      imports: [FormsModule, SharedUiModule, TranslateModule.forRoot()],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
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

  it("should guard platform selection when dev flags are disabled", () => {
    const devFlags = TestBed.inject(DevFlagsService);

    // gitlab-cloud is disabled
    component.selectPlatform("gitlab-cloud");
    expect(component.selectedPlatform).toBe("github");

    // Enable gitlab-cloud
    (devFlags as any).gitlabCloudEnabled = true;
    component.selectPlatform("gitlab-cloud");
    expect(component.selectedPlatform).toBe("gitlab-cloud");
  });

  it("should handle the two-step disconnect confirmation flow", () => {
    expect(component.isConfirmingDisconnect).toBeFalse();

    // First click enters confirmation mode
    component.onDisconnectClick();
    expect(component.isConfirmingDisconnect).toBeTrue();
    expect(authServiceSpy.signOut).not.toHaveBeenCalled();

    // Second click performs disconnect
    component.onDisconnectClick();
    expect(authServiceSpy.signOut).toHaveBeenCalled();
    expect(component.isConfirmingDisconnect).toBeFalse();
  });

  it("should cancel confirmation on cancel click or escape key", () => {
    component.onDisconnectClick();
    expect(component.isConfirmingDisconnect).toBeTrue();

    component.cancelConfirmDisconnect();
    expect(component.isConfirmingDisconnect).toBeFalse();

    // Test Escape key handling
    component.onDisconnectClick();
    expect(component.isConfirmingDisconnect).toBeTrue();

    const escapeEvent = new KeyboardEvent("keydown", { key: "Escape" });
    component.onEscape(escapeEvent);
    expect(component.isConfirmingDisconnect).toBeFalse();
  });
});
