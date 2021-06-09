import { Component, OnInit } from "@angular/core";
import { AuthService } from "@services/auth.service";
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
   * @param {AuthService} authService The service managing authentication
   */
  constructor(public authService: AuthService) {}

  version = environment.version;

  ngOnInit() {}

  onSignInGithub() {
    this.authService.signIn();
  }

  scroll(el: HTMLElement) {
    el.scrollIntoView({ block: "end", behavior: "smooth" });
  }
}
