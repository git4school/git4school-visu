import { Component, HostListener, OnDestroy, OnInit } from "@angular/core";
import { Subscription } from "rxjs";
import { TranslateService } from "@ngx-translate/core";
import { CustomModalRef } from "@shared/ui/custom-modal/custom-modal-ref";
import { AuthService } from "@services/auth.service";
import { AccountsService } from "@services/accounts.service";
import { DevFlagsService } from "@services/dev-flags.service";

@Component({
  selector: "app-add-account-modal",
  templateUrl: "./add-account-modal.component.html",
  styleUrls: ["./add-account-modal.component.scss"],
})
export class AddAccountModalComponent implements OnInit, OnDestroy {
  selectedPlatform: 'github' | 'gitlab-cloud' | 'gitlab-custom' = 'github';
  isConnecting = false;
  isConfirmingDisconnect = false;
  errorMessage = "";

  gitlabInstanceUrl = "";
  gitlabToken = "";

  private flagsSub: Subscription | null = null;

  constructor(
    public modalRef: CustomModalRef,
    public accountsService: AccountsService,
    public authService: AuthService,
    public devFlagsService: DevFlagsService,
    private translateService: TranslateService
  ) {}

  get isGithubConnected(): boolean {
    return !!this.authService.isSignedIn();
  }

  get profileUrl(): string {
    const user = this.authService.username || "";
    return user ? `https://github.com/${user}` : "https://github.com";
  }

  ngOnInit(): void {
    this.selectedPlatform = "github";

    // Watch flags: if active platform is disabled, reset to github
    this.flagsSub = this.devFlagsService.gitlabCloudEnabled$.subscribe((enabled) => {
      if (!enabled && this.selectedPlatform === "gitlab-cloud") {
        this.selectedPlatform = "github";
      }
    });

    this.flagsSub.add(
      this.devFlagsService.gitlabCustomEnabled$.subscribe((enabled) => {
        if (!enabled && this.selectedPlatform === "gitlab-custom") {
          this.selectedPlatform = "github";
        }
      })
    );
  }

  ngOnDestroy(): void {
    if (this.flagsSub) {
      this.flagsSub.unsubscribe();
    }
  }

  selectPlatform(platform: 'github' | 'gitlab-cloud' | 'gitlab-custom'): void {
    if (platform === "gitlab-cloud" && !this.devFlagsService.gitlabCloudEnabled) {
      return;
    }
    if (platform === "gitlab-custom" && !this.devFlagsService.gitlabCustomEnabled) {
      return;
    }
    this.selectedPlatform = platform;
    this.errorMessage = "";
  }

  @HostListener("document:keydown.escape", ["$event"])
  onEscape(event: KeyboardEvent): void {
    if (this.isConfirmingDisconnect) {
      event.stopImmediatePropagation();
      this.isConfirmingDisconnect = false;
    }
  }

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent): void {
    if (this.isConfirmingDisconnect) {
      const target = event.target as HTMLElement;
      if (!target.closest(".action-buttons-group")) {
        this.isConfirmingDisconnect = false;
      }
    }
  }

  async submitConnect(): Promise<void> {
    this.isConnecting = true;
    this.errorMessage = "";

    try {
      await this.authService.signIn();
      this.isConnecting = false;
      this.modalRef.close();
    } catch (err: any) {
      this.isConnecting = false;
      if (err?.code === "auth/popup-closed-by-user") {
        this.errorMessage = this.translateService.instant("ACCOUNTS.POPUP_CLOSED");
      } else if (err?.message) {
        this.errorMessage = err.message;
      } else {
        this.errorMessage = this.translateService.instant("ACCOUNTS.LOGIN_ERROR");
      }
    }
  }

  async submitGitlabCloud(): Promise<void> {
    this.isConnecting = true;
    this.errorMessage = "";
    setTimeout(() => {
      this.isConnecting = false;
      this.errorMessage = "La connexion GitLab OAuth est en cours de développement.";
    }, 600);
  }

  async submitGitlabCustom(): Promise<void> {
    this.isConnecting = true;
    this.errorMessage = "";
    setTimeout(() => {
      this.isConnecting = false;
      this.errorMessage = `Vérification du token PAT pour l'instance "${this.gitlabInstanceUrl}"... (Mode Dev)`;
    }, 600);
  }

  onDisconnectClick(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    if (!this.isConfirmingDisconnect) {
      this.isConfirmingDisconnect = true;
    } else {
      this.disconnectGithub();
    }
  }

  disconnectGithub(): void {
    this.authService.signOut();
    this.isConfirmingDisconnect = false;
  }

  cancelConfirmDisconnect(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.isConfirmingDisconnect = false;
  }

  close(): void {
    this.modalRef.close();
  }
}
