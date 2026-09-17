import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

@Component({
  selector: "app-gitlab-callback",
  templateUrl: "./gitlab-callback.component.html",
  styleUrls: ["./gitlab-callback.component.scss"],
})
export class GitlabCallbackComponent implements OnInit {
  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    const searchParams = new URLSearchParams(window.location.search);
    const code = this.route.snapshot.queryParamMap.get("code") || searchParams.get("code");
    const state = this.route.snapshot.queryParamMap.get("state") || searchParams.get("state");
    const error = this.route.snapshot.queryParamMap.get("error") || searchParams.get("error");
    const errorDescription = this.route.snapshot.queryParamMap.get("error_description") || searchParams.get("error_description");

    const payload = {
      type: "GITLAB_OAUTH_CALLBACK",
      code,
      state,
      error,
      errorDescription,
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem("gitlab_oauth_callback_data", JSON.stringify(payload));
    } catch (e) {
      console.warn("Could not write oauth callback data to localStorage:", e);
    }

    if (window.opener) {
      try {
        window.opener.postMessage(payload, window.location.origin);
      } catch (e) {
        console.warn("Could not postMessage to opener:", e);
      }
    }

    setTimeout(() => {
      window.close();
      if (!window.opener) {
        this.router.navigate(["/home"]);
      }
    }, 200);
  }
}
