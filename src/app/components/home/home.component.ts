import { Component, OnInit } from "@angular/core";
import { AuthService } from "@services/auth.service";
import { TourService } from "@services/tour.service";
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
  /**
   * HomeComponent constructor
   * @param authService The service managing authentication
   */
  constructor(
      public authService: AuthService,
      private tourService: TourService
  ) {}

  version = environment.version;

  ngOnInit() {
      // Small timeout to ensure DOM is ready
      setTimeout(() => {
          if (this.authService.isSignedIn() && this.tourService.shouldShowTour()) {
              this.tourService.startTour();
          }
      }, 500);
  }

  async onSignInGithub() {
    await this.authService.signIn();
    if (this.authService.isSignedIn() && this.tourService.shouldShowTour()) {
        setTimeout(() => this.tourService.startTour(), 500);
    }
  }

  scroll(el: HTMLElement) {
    el.scrollIntoView({ block: "end", behavior: "smooth" });
  }
}
