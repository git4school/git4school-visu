import { Component, OnInit, HostListener, ChangeDetectorRef } from "@angular/core";
import { CustomModalService } from "@shared/ui/custom-modal/custom-modal.service";
import { Account } from "@models/Account.model";
import { AccountsService } from "@services/accounts.service";
import { OverlayManagerService, OverlayType } from "@services/overlay-manager.service";
import { AddAccountModalComponent } from "./add-account-modal/add-account-modal.component";

@Component({
  selector: "app-accounts",
  templateUrl: "./accounts.component.html",
  styleUrls: ["./accounts.component.scss"],
})
export class AccountsComponent implements OnInit {
  confirmDisconnectId: string | null = null;

  constructor(
    public accountsService: AccountsService,
    private customModalService: CustomModalService,
    private cdr: ChangeDetectorRef,
    private overlayManagerService: OverlayManagerService,
  ) {}

  @HostListener("document:keydown.escape")
  onEscape(): void {
    if (this.confirmDisconnectId) {
      this.confirmDisconnectId = null;
      this.cdr.detectChanges();
    }
  }

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent): void {
    if (this.confirmDisconnectId) {
      const target = event.target as HTMLElement;
      if (!target.closest(".account-card.confirming")) {
        this.confirmDisconnectId = null;
        this.cdr.detectChanges();
      }
    }
  }

  ngOnInit(): void {}

  onDisconnectClick(account: Account, event: MouseEvent): void {
    event.stopPropagation();
    this.overlayManagerService.dismiss(OverlayType.TOOLTIP);
    if (this.confirmDisconnectId === account.id) {
      this.accountsService.disconnectAccount(account.id);
      this.confirmDisconnectId = null;
    } else {
      this.confirmDisconnectId = account.id;
    }
    this.cdr.detectChanges();
  }

  cancelDisconnect(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.overlayManagerService.dismiss(OverlayType.TOOLTIP);
    this.confirmDisconnectId = null;
    this.cdr.detectChanges();
  }

  onAddAccount(): void {
    this.customModalService.open(AddAccountModalComponent, { size: "md" });
  }

  getProfileUrl(account: Account): string {
    return this.accountsService.getProfileUrl(account);
  }
}
