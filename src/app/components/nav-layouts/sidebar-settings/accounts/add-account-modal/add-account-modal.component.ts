import { Component, HostListener, OnDestroy, OnInit } from "@angular/core";
import { Subscription } from "rxjs";
import { TranslateService } from "@ngx-translate/core";
import { CustomModalRef } from "@shared/ui/custom-modal/custom-modal-ref";
import { AccountsService } from "@services/accounts.service";
import { DevFlagsService } from "@services/dev-flags.service";
import { GitAuthProvider } from "@models/GitAuthProvider.model";
import { Account } from "@models/Account.model";

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
  rememberMe = false;

  gitlabInstanceUrl = "";
  gitlabToken = "";

  private flagsSub: Subscription | null = null;

  constructor(
    public modalRef: CustomModalRef,
    public accountsService: AccountsService,
    public devFlagsService: DevFlagsService,
    private translateService: TranslateService,
  ) {}

  get currentProvider(): GitAuthProvider | undefined {
    if (this.selectedPlatform === "github") {
      return this.accountsService.getProvider("github");
    }
    if (this.selectedPlatform === "gitlab-cloud") {
      return this.accountsService.getProvider("gitlab");
    }
    return undefined;
  }

  get isConnected(): boolean {
    return !!this.currentProvider?.isSignedIn();
  }

  get connectedAccount(): Account | null {
    return this.currentProvider?.getAccount() || null;
  }

  get isGithubConnected(): boolean {
    return this.accountsService.isGithubConnected;
  }

  get isGitlabConnected(): boolean {
    return this.accountsService.isGitlabConnected;
  }

  get platformAuthTypeKey(): string {
    switch (this.selectedPlatform) {
      case "gitlab-cloud":
        return "ACCOUNTS.AUTH_TYPE_OAUTH_PKCE";
      case "gitlab-custom":
        return "ACCOUNTS.AUTH_TYPE_PAT";
      default:
        return "ACCOUNTS.AUTH_TYPE_OAUTH";
    }
  }

  get profileUrl(): string {
    return this.currentProvider?.getProfileUrl() || "#";
  }

  get gitlabProfileUrl(): string {
    return this.accountsService.getProvider("gitlab")?.getProfileUrl() || "https://gitlab.com";
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

    this.flagsSub = this.devFlagsService.gitlabCustomEnabled$.subscribe((enabled) => {
      if (!enabled && this.selectedPlatform === "gitlab-custom") {
        this.selectedPlatform = "github";
      }
    });
  }

  ngOnDestroy(): void {
    this.flagsSub?.unsubscribe();
  }

  selectPlatform(platform: "github" | "gitlab-cloud" | "gitlab-custom"): void {
    const allowed: Record<string, boolean> = {
      github: true,
      "gitlab-cloud": true,
      "gitlab-custom": this.devFlagsService.gitlabCustomEnabled,
    };
    if (allowed[platform]) {
      this.selectedPlatform = platform;
      this.errorMessage = "";
    }
  }

  async submitConnect(): Promise<void> {
    const provider = this.currentProvider;
    if (!provider) {
      return;
    }

    this.isConnecting = true;
    this.errorMessage = "";

    try {
      await provider.signIn(this.rememberMe);
      this.modalRef.close();
    } catch (err: any) {
      if (err?.code === "auth/popup-closed-by-user" || err?.message === "POPUP_CLOSED") {
        this.errorMessage = this.translateService.instant("ACCOUNTS.POPUP_CLOSED");
      } else {
        this.errorMessage = err?.message || this.translateService.instant("ACCOUNTS.LOGIN_ERROR");
      }
    } finally {
      this.isConnecting = false;
    }
  }

  async submitGitlabCustom(): Promise<void> {
    this.isConnecting = true;
    this.errorMessage = "";
    setTimeout(() => {
      this.isConnecting = false;
      this.errorMessage = this.translateService.instant("ACCOUNTS.DEV_MODE_PAT", { url: this.gitlabInstanceUrl });
    }, 600);
  }

  onDisconnectClick(event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.isConfirmingDisconnect) {
      this.currentProvider?.signOut();
      this.isConfirmingDisconnect = false;
    } else {
      this.isConfirmingDisconnect = true;
    }
  }

  cancelConfirmDisconnect(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isConfirmingDisconnect = false;
  }

  close(): void {
    this.modalRef.close();
  }
}
