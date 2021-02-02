import { Component, OnInit } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { AuthService } from "@services/auth.service";

@Component({
  selector: "auth-lang-nav-item",
  templateUrl: "./auth-lang-nav-item.component.html",
  styleUrls: ["./auth-lang-nav-item.component.scss"],
  // changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLangNavItemComponent implements OnInit {
  constructor(
    public translateService: TranslateService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {}

  changeLanguage(language: string) {
    this.translateService.use(language);
  }

  /**
   * Signs in
   */
  onSignInGithub() {
    this.authService.signIn();
  }

  /**
   * Signs out
   */
  onSignOut() {
    this.authService.signOut();
  }
}
