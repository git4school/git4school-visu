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
  selectedPlatform: "github" | "gitlab-cloud" | "gitlab-custom" = "github";
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
    private translateService: TranslateService,
  ) {}

  get isGithubConnected(): boolean {
    return !!this.authService.isSignedIn();
  }

  get profileUrl(): string {
    const user = this.authService.username || "";
    return user ? `https://github.com/${user}` : "https://github.com";
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
    const target = event.target as HTMLElement;
    if (this.isConfirmingDisconnect && !target?.closest(".action-buttons-group")) {
      this.isConfirmingDisconnect = false;
    }
  }

  ngOnInit(): void {
    this.selectedPlatform = "github";

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
      }),
    );
  }

  ngOnDestroy(): void {
    this.flagsSub?.unsubscribe();
  }

  selectPlatform(platform: "github" | "gitlab-cloud" | "gitlab-custom"): void {
    const allowed: Record<string, boolean> = {
      github: true,
      "gitlab-cloud": this.devFlagsService.gitlabCloudEnabled,
      "gitlab-custom": this.devFlagsService.gitlabCustomEnabled,
    };
    if (allowed[platform]) {
      this.selectedPlatform = platform;
      this.errorMessage = "";
    }
  }

  async submitConnect(): Promise<void> {
    this.isConnecting = true;
    this.errorMessage = "";

    try {
      await this.authService.signIn();
      this.modalRef.close();
    } catch (err: any) {
      this.errorMessage =
        err?.code === "auth/popup-closed-by-user"
          ? this.translateService.instant("ACCOUNTS.POPUP_CLOSED")
          : err?.message || this.translateService.instant("ACCOUNTS.LOGIN_ERROR");
    } finally {
      this.isConnecting = false;
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
    event?.stopPropagation();
    if (this.isConfirmingDisconnect) {
      this.disconnectGithub();
    } else {
      this.isConfirmingDisconnect = true;
    }
  }

  disconnectGithub(): void {
    this.authService.signOut();
    this.isConfirmingDisconnect = false;
  }

  cancelConfirmDisconnect(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isConfirmingDisconnect = false;
  }

  close(): void {
    this.modalRef.close();
  }
}
