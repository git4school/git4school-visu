import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { Milestone } from "@models/Milestone.model";
import { Session } from "@models/Session.model";
import { NgbDropdown } from "@ng-bootstrap/ng-bootstrap";

@Component({
  selector: "overview-graph-contextual-menu",
  templateUrl: "./overview-graph-contextual-menu.component.html",
  styleUrls: ["./overview-graph-contextual-menu.component.scss"],
})
export class OverviewGraphContextualMenuComponent implements OnInit {
  @ViewChild(NgbDropdown) dropdown;
  @Output() deleteMilestone = new EventEmitter<Milestone>();

  left: string;
  top: string;
  editMilestoneMode: boolean;
  editSessionMode: boolean;
  milestone: Milestone;
  session: Session;

  constructor() {}

  ngOnInit(): void {
    this.setEditModes(false, false);
  }

  openEditMilestone(milestone: Milestone, x: number, y: number) {
    this.milestone = milestone;
    this.setEditModes(true, false);
    this.setPosition(x, y);
    this.dropdown.open();
  }

  openEditSession(session: Session, x: number, y: number) {
    this.setEditModes(false, true);
    this.setPosition(x, y);
    this.dropdown.open();
  }

  openNew(x: number, y: number) {
    this.setEditModes(false, false);
    this.setPosition(x, y);
    this.dropdown.open();
  }

  close() {
    this.dropdown.close();
  }

  isContextMenuOpen(): boolean {
    return this.dropdown.isOpen();
  }

  removeMilestone() {
    this.deleteMilestone.emit(this.milestone);
  }

  private setPosition(x: number, y: number) {
    this.left = `${x}px`;
    this.top = `${y}px`;
  }

  private setEditModes(milestoneMode: boolean, sessionMode: boolean) {
    this.editMilestoneMode = milestoneMode;
    this.editSessionMode = sessionMode;
  }
}
