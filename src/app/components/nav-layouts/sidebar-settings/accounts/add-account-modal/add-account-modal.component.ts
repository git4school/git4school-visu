import { Component, HostListener, OnDestroy, OnInit, ChangeDetectorRef } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { CustomModalRef } from "@shared/ui/custom-modal/custom-modal-ref";
import { AccountsService } from "@services/accounts.service";
import { DevFlagsService } from "@services/dev-flags.service";
import { OverlayManagerService, OverlayType } from "@services/overlay-manager.service";
import { GitAuthProvider } from "@models/GitAuthProvider.model";
import { Account } from "@models/Account.model";
import { Subscription } from "rxjs";

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
  gitlabInstanceAlias = "";
  gitlabToken = "";

  isCustomDropdownOpen = false;
  showAddCustomInstanceForm = false;
  selectedCustomInstanceHost: string | null = null;

  private overlaySub?: Subscription;
  private accountsSub?: Subscription;
  private boundOutsideClick?: (event: MouseEvent) => void;

  constructor(
    public modalRef: CustomModalRef,
    public accountsService: AccountsService,
    public devFlagsService: DevFlagsService,
    private translateService: TranslateService,
    private overlayManagerService: OverlayManagerService,
    private cdr: ChangeDetectorRef,
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
    return Boolean(this.accountsService.gitlabAuthService?.isSignedIn() || this.accountsService.getProvider("gitlab")?.isSignedIn());
  }

  get customGitlabAccounts(): Account[] {
    return this.accountsService.gitlabCustomAuthService?.getAccounts() || [];
  }

  get hasConnectedCustomInstances(): boolean {
    return Boolean(this.customGitlabAccounts && this.customGitlabAccounts.length > 0);
  }

  get customInstancesCountText(): string {
    const count = this.customGitlabAccounts.length;
    if (count === 1) {
      return this.translateService.instant("ACCOUNTS.INSTANCES_COUNT_SINGULAR");
    }
    return this.translateService.instant("ACCOUNTS.INSTANCES_COUNT_PLURAL", { count });
  }

  get selectedCustomAccount(): Account | null {
    if (this.selectedCustomInstanceHost) {
      return this.accountsService.gitlabCustomAuthService?.getAccount(this.selectedCustomInstanceHost) || null;
    }
    return this.customGitlabAccounts[0] || null;
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

  get customProfileUrl(): string {
    const acc = this.selectedCustomAccount;
    if (!acc) {
      return "#";
    }
    return this.accountsService.gitlabCustomAuthService.getProfileUrl(acc.instanceHost, acc.username);
  }

  @HostListener("document:keydown.escape", ["$event"])
  onEscape(event: KeyboardEvent): void {
    if (this.isCustomDropdownOpen) {
      event.stopImmediatePropagation();
      this.isCustomDropdownOpen = false;
      this.cdr.markForCheck();
      return;
    }
    if (this.isConfirmingDisconnect) {
      event.stopImmediatePropagation();
      this.isConfirmingDisconnect = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent): void {
    this.handleOutsideClick(event);
  }

  ngOnInit(): void {
    this.selectedPlatform = "github";

    this.overlaySub = this.overlayManagerService.dismiss$.subscribe((event) => {
      if (this.isCustomDropdownOpen && OverlayManagerService.shouldDismiss(OverlayType.DROPDOWN, event)) {
        this.isCustomDropdownOpen = false;
        this.cdr.markForCheck();
      }
    });

    if (this.accountsService.gitlabCustomAuthService?.accountsChange$) {
      this.accountsSub = this.accountsService.gitlabCustomAuthService.accountsChange$.subscribe(() => {
        if (!this.hasConnectedCustomInstances) {
          this.isCustomDropdownOpen = false;
          this.selectedCustomInstanceHost = null;
          if (this.selectedPlatform === "gitlab-custom") {
            this.showAddCustomInstanceForm = true;
          }
        }
        this.cdr.markForCheck();
      });
    }

    this.boundOutsideClick = (event: MouseEvent) => this.handleOutsideClick(event);
    document.addEventListener("click", this.boundOutsideClick, { capture: true });
  }

  ngOnDestroy(): void {
    if (this.boundOutsideClick) {
      document.removeEventListener("click", this.boundOutsideClick, { capture: true });
    }
    if (this.overlaySub) {
      this.overlaySub.unsubscribe();
    }
    if (this.accountsSub) {
      this.accountsSub.unsubscribe();
    }
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
      this.isCustomDropdownOpen = false;
    }
  }

  onCustomCardClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target?.closest(".custom-instances-dropdown")) {
      return;
    }

    if (this.selectedPlatform !== "gitlab-custom") {
      this.selectedPlatform = "gitlab-custom";
      this.errorMessage = "";
      if (this.hasConnectedCustomInstances) {
        this.selectedCustomInstanceHost = this.customGitlabAccounts[0].instanceHost;
        this.showAddCustomInstanceForm = false;
        this.isCustomDropdownOpen = true;
      } else {
        this.showAddCustomInstanceForm = true;
        this.isCustomDropdownOpen = false;
      }
    } else {
      if (this.hasConnectedCustomInstances) {
        this.isCustomDropdownOpen = !this.isCustomDropdownOpen;
      } else {
        this.isCustomDropdownOpen = false;
      }
    }

    if (this.isCustomDropdownOpen) {
      this.overlayManagerService.dismissAll({ exclude: [OverlayType.DROPDOWN] });
    }
    this.cdr.markForCheck();
  }

  selectCustomInstance(host: string): void {
    this.selectedCustomInstanceHost = host;
    this.showAddCustomInstanceForm = false;
    this.isCustomDropdownOpen = false;
    this.errorMessage = "";
  }

  openAddCustomInstanceForm(): void {
    this.showAddCustomInstanceForm = true;
    this.isCustomDropdownOpen = false;
    this.gitlabInstanceUrl = "";
    this.gitlabInstanceAlias = "";
    this.gitlabToken = "";
    this.errorMessage = "";
  }

  cancelAddCustomInstanceForm(): void {
    if (this.hasConnectedCustomInstances) {
      this.showAddCustomInstanceForm = false;
      if (!this.selectedCustomInstanceHost) {
        this.selectedCustomInstanceHost = this.customGitlabAccounts[0].instanceHost;
      }
      this.errorMessage = "";
      this.cdr.markForCheck();
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

    try {
      const account = await this.accountsService.gitlabCustomAuthService.connectInstance(
        this.gitlabInstanceUrl,
        this.gitlabToken,
        this.gitlabInstanceAlias,
        this.rememberMe,
      );
      this.selectedCustomInstanceHost = account.instanceHost;
      this.showAddCustomInstanceForm = false;
      this.gitlabInstanceUrl = "";
      this.gitlabInstanceAlias = "";
      this.gitlabToken = "";
      this.modalRef.close();
    } catch (err: any) {
      if (err?.message === "INVALID_PAT") {
        this.errorMessage = this.translateService.instant("ACCOUNTS.INVALID_PAT");
      } else if (err?.message === "SERVER_UNREACHABLE") {
        this.errorMessage = this.translateService.instant("ACCOUNTS.SERVER_UNREACHABLE");
      } else if (err?.message === "INVALID_HOST") {
        this.errorMessage = this.translateService.instant("ACCOUNTS.INVALID_HOST");
      } else {
        this.errorMessage = err?.message || this.translateService.instant("ACCOUNTS.LOGIN_ERROR");
      }
    } finally {
      this.isConnecting = false;
    }
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

  onDisconnectCustomClick(event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.isConfirmingDisconnect) {
      const targetHost = this.selectedCustomInstanceHost || this.customGitlabAccounts[0]?.instanceHost;
      if (targetHost) {
        this.accountsService.gitlabCustomAuthService.disconnectInstance(targetHost);
        const remaining = this.customGitlabAccounts;
        if (remaining.length > 0) {
          this.selectedCustomInstanceHost = remaining[0].instanceHost;
        } else {
          this.selectedCustomInstanceHost = null;
          this.showAddCustomInstanceForm = true;
          this.isCustomDropdownOpen = false;
        }
      }
      this.isConfirmingDisconnect = false;
      this.cdr.markForCheck();
    } else {
      this.isConfirmingDisconnect = true;
      this.cdr.markForCheck();
    }
  }

  cancelConfirmDisconnect(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isConfirmingDisconnect = false;
  }

  close(): void {
    this.modalRef.close();
  }

  private handleOutsideClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.isCustomDropdownOpen && !target?.closest(".platform-card-custom")) {
      this.isCustomDropdownOpen = false;
      this.cdr.markForCheck();
    }
    if (this.isConfirmingDisconnect && !target?.closest(".action-buttons-group")) {
      this.isConfirmingDisconnect = false;
      this.cdr.markForCheck();
    }
  }
}
