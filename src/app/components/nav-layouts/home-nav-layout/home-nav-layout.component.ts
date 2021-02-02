import { Component, OnInit } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { AuthService } from "@services/auth.service";
import { DataService } from "@services/data.service";

@Component({
  selector: "app-home-nav-layout",
  templateUrl: "./home-nav-layout.component.html",
  styleUrls: ["./home-nav-layout.component.scss"],
})
export class HomeNavLayoutComponent implements OnInit {
  constructor(
    public authService: AuthService,
    public dataService: DataService,
    public translateService: TranslateService
  ) {}

  ngOnInit(): void {}
}
