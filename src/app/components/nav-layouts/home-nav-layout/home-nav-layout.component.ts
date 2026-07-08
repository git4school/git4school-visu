import { Component, OnInit } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { AuthService } from "@services/auth.service";
import { DataService } from "@services/data.service";
import { ThemeService } from "@services/theme.service";

@Component({
  selector: "app-home-nav-layout",
  templateUrl: "./home-nav-layout.component.html",
  styleUrls: ["./home-nav-layout.component.scss"],
})
export class HomeNavLayoutComponent implements OnInit {
  constructor(
    public authService: AuthService,
    public dataService: DataService,
    public translateService: TranslateService,
    public themeService: ThemeService
  ) {}

  isSidebarPinned = false;
  isSidebarHovered = false;

  ngOnInit(): void {
    const savedPin = localStorage.getItem("sidebarPinned");
    if (savedPin) {
      this.isSidebarPinned = savedPin === "true";
    }
  }

  toggleSidebarPin() {
    this.isSidebarPinned = !this.isSidebarPinned;
    localStorage.setItem("sidebarPinned", String(this.isSidebarPinned));
  }

  closeSidebar() {
    this.isSidebarHovered = false;
  }

  hoverTimeout: any;

  onSidebarEnter() {
    clearTimeout(this.hoverTimeout);
    this.isSidebarHovered = true;
  }

  onSidebarLeave() {
    this.hoverTimeout = setTimeout(() => {
      this.isSidebarHovered = false;
    }, 200);
  }
}
