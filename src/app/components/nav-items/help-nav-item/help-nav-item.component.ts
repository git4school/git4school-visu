import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";

@Component({
  selector: "help-nav-item",
  templateUrl: "./help-nav-item.component.html",
  styleUrls: ["./help-nav-item.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpNavItemComponent implements OnInit {
  constructor() {}

  ngOnInit(): void {}

  openUserDocumentation() {
    window.open("https://git4school.github.io/", "_blank");
  }
}
