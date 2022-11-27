import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { EditMilestoneComponent } from "@components/edit-milestone/edit-milestone.component";
import { EditSessionComponent } from "@components/edit-session/edit-session.component";
import { Milestone } from "@models/Milestone.model";
import { Session } from "@models/Session.model";
import { NgbDropdown, NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { Utils } from "@services/utils";

@Component({
  selector: "overview-graph-contextual-menu",
  templateUrl: "./overview-graph-contextual-menu.component.html",
  styleUrls: ["./overview-graph-contextual-menu.component.scss"],
})
export class OverviewGraphContextualMenuComponent implements OnInit {
  @ViewChild(NgbDropdown) dropdown;
  @Input() questions: string[];
  @Input() tpGroups: string[];
  @Input() typeaheadSettings;
  @Input() defaultSessionDuration;
  @Input() groupFilter: string;
  @Output() saveMilestone = new EventEmitter<{
    oldMilestone: Milestone;
    newMilestone: Milestone;
  }>();
  @Output() saveSession = new EventEmitter<{
    oldSession: Session;
    newSession: Session;
  }>();
  @Output() deleteMilestone = new EventEmitter<Milestone>();
  @Output() deleteSession = new EventEmitter<Session>();

  left: string;
  top: string;
  editMilestoneMode: boolean;
  editSessionMode: boolean;
  milestone: Milestone;
  session: Session;
  date: Date;

  constructor(private modalService: NgbModal) {}

  ngOnInit(): void {
    this.setEditModes(false, false);
  }

  /////////////// External methods to manipulate context menu /////////////////////////////
  openEditMilestone(milestone: Milestone, x: number, y: number, date: Date) {
    this.milestone = milestone;
    this.setEditModes(true, false);
    this.setPosition(x, y);
    this.date = date;
    this.dropdown.open();
  }

  openEditSession(session: Session, x: number, y: number, date: Date) {
    this.session = session;
    this.setEditModes(false, true);
    this.setPosition(x, y);
    this.date = date;
    this.dropdown.open();
  }

  openNew(x: number, y: number, date: Date) {
    this.setEditModes(false, false);
    this.setPosition(x, y);
    this.date = date;
    this.dropdown.open();
  }

  close() {
    this.dropdown.close();
  }

  isContextMenuOpen(): boolean {
    return this.dropdown.isOpen();
  }
  //////////////////////////////////////////////////////////////////////////////////////

  editMilestone() {
    this.openMilestoneModal(this.milestone);
  }

  editSession() {
    this.openSessionModal(this.session);
  }

  addMilestone() {
    this.milestone = null;
    this.openMilestoneModal(
      new Milestone(this.date, "", void 0, this.groupFilter)
    );
  }

  addSession() {
    this.session = null;
    let endDate = Utils.addTimeToDate(this.date, this.defaultSessionDuration);
    this.openSessionModal(new Session(this.date, endDate, this.groupFilter));
  }

  removeMilestone(milestone: Milestone) {
    this.deleteMilestone.emit(milestone);
  }

  removeSession(session: Session) {
    this.deleteSession.emit(session);
  }

  openMilestoneModal(milestone: Milestone) {
    let modalReference = this.modalService.open(EditMilestoneComponent, {});
    modalReference.componentInstance.milestone = milestone;
    modalReference.componentInstance.addMode = !this.editMilestoneMode;
    modalReference.componentInstance.tpGroups = this.tpGroups;
    modalReference.componentInstance.questions = this.questions;
    modalReference.componentInstance.typeaheadSettings = this.typeaheadSettings;
    modalReference.result
      .then((newMilestone) => {
        this.saveMilestone.emit({ oldMilestone: this.milestone, newMilestone });
      })
      .catch((e) => {});
  }

  openSessionModal(session: Session) {
    let modalReference = this.modalService.open(EditSessionComponent, {});
    modalReference.componentInstance.session = session;
    modalReference.componentInstance.defaultSessionDuration =
      this.defaultSessionDuration;
    modalReference.componentInstance.addMode = !this.editSessionMode;
    modalReference.componentInstance.tpGroups = this.tpGroups;
    modalReference.result
      .then((newSession) => {
        this.saveSession.emit({ oldSession: this.session, newSession });
      })
      .catch((e) => {});
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
