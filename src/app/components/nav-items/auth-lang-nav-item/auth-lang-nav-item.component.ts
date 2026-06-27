import { Component, OnInit, Output, EventEmitter } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { AuthService } from "@services/auth.service";
import { TourService } from "@services/tour.service";

@Component({
  selector: "auth-lang-nav-item",
  templateUrl: "./auth-lang-nav-item.component.html",
  styleUrls: ["./auth-lang-nav-item.component.scss"],
  // changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLangNavItemComponent implements OnInit {
  @Output() onClose = new EventEmitter<void>();

  langNames: { [key: string]: string } = {
    en: "English",
    fr: "Français",
    ru: "Русский"
  };

  constructor(
    public translateService: TranslateService,
    public authService: AuthService,
    private tourService: TourService
  ) {}

  ngOnInit(): void {}

  changeLanguage(language: string) {
    this.translateService.use(language);
    localStorage.setItem("language", language);
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

  /**
   * Replays the onboarding tour
   */
  replayTour() {
    this.onClose.emit();
    // Use timeout to let the sidebar close animation finish
    setTimeout(() => {
        this.tourService.startTour();
    }, 300);
  }
}
