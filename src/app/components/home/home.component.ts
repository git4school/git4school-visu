import { Component, OnInit } from "@angular/core";
import { AuthService } from "@services/auth.service";
import { CustomModalService } from "@shared/ui/custom-modal/custom-modal.service";
import { AccountsService } from "@services/accounts.service";
import { AddAccountModalComponent } from "../nav-layouts/sidebar-settings/accounts/add-account-modal/add-account-modal.component";
import { environment } from "../../../environments/environment";

/**
 * This component is used for the Home page displaying useful information such as CHANGELOG,
 * a user guide or help with the structure of the configuration file or the ReadMe of the repositories
 */
@Component({
  selector: "home",
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.scss"],
})
export class HomeComponent implements OnInit {
  version = environment.version;

  /**
   * HomeComponent constructor
   * @param authService The service managing authentication
   * @param accountsService The service managing connected accounts
   * @param customModalService The modal service
   */
  constructor(
    public authService: AuthService,
    public accountsService: AccountsService,
    private customModalService: CustomModalService
  ) {}

  ngOnInit() {
    window.addEventListener("git4school:open-accounts-modal", () =>
      this.onAddAccount()
    );
  }

  onAddAccount() {
    this.customModalService.open(AddAccountModalComponent, { size: "md" });
  }

  async onSignInGithub() {
    await this.authService.signIn();
  }

  scroll(el: HTMLElement) {
    el.scrollIntoView({ block: "end", behavior: "smooth" });
  }
}
