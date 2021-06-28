import { Component, OnInit, TemplateRef, ViewChild } from "@angular/core";
import { Router } from "@angular/router";
import { Assignment } from "@models/Assignment.model";
import {
  NgbActiveModal,
  NgbModal,
  NgbModalRef,
} from "@ng-bootstrap/ng-bootstrap";
import { TranslateService } from "@ngx-translate/core";
import { AssignmentsService } from "@services/assignments.service";
import { AuthService } from "@services/auth.service";
import { ConfigurationService } from "@services/configuration.service";
import { DataService } from "@services/data.service";
import { DatabaseService } from "@services/database.service";
import { ToastService } from "@services/toast.service";
import { DatePipe } from "@angular/common";

@Component({
  selector: "assignment-chooser",
  templateUrl: "./assignment-chooser.component.html",
  styleUrls: ["./assignment-chooser.component.scss"],
  // changeDetection: ChangeDetectionStrategy.OnPush
})

export class AssignmentChooserComponent implements OnInit {
  @ViewChild("assignmentsTable") table: any;
  @ViewChild("importConfirmation")
  private importConfirmation: TemplateRef<any>;
  assignments: Assignment[];
  modalRef: NgbModalRef;
  private _modeView: String;


  constructor(
    private databaseService: DatabaseService,
    private dataService: DataService,
    private modalService: NgbModal,
    private router: Router,
    public authService: AuthService,
    private translateService: TranslateService,
    private toastService: ToastService,
    public activeModalService: NgbActiveModal,
    private assignmentsService: AssignmentsService,
    private configurationService: ConfigurationService,
    private datePipe: DatePipe,
  ) {}

  ngOnInit(): void {
    this.modeView = "detailsMode";
    this.initContentTable();
  }

  ngAfterViewInit(): void {
    this.openFirstGroup();
  }

  initContentTable() {
    this.assignments = [];
    this.loadAssignments();
  }

  openFirstGroup() {
    setTimeout(() => this.table.groupHeader.toggleExpandGroup(this.table.groupedRows[0]), 100);
  }

  async loadAssignments() {
    await this.databaseService
      .getAllAssignments()
      .then((assignments) => (this.assignments = assignments));
  }

  selectAssignment(assignment: Assignment) {
    this.dataService.assignment = assignment;
    if (this.dataService.repoToLoad) {
      this.router.navigate(["overview"]);
    }
  }

  deleteAssignment(assignment: Assignment) {
    this.databaseService.deleteAssignment(assignment.id);
    this.loadAssignments();
  }

  createAssignment() {
    let assignment = new Assignment();
    this.openConfigurationModal(assignment);
  }

  openConfigurationModal(assignment: Assignment) {
    this.configurationService.openConfigurationModal(assignment).finally(() => {
      this.loadAssignments();
      if (assignment.id && assignment.id === this.dataService.assignment?.id) {
        this.databaseService
          .getAssignmentById(assignment.id)
          .then((assignment) => (this.dataService.assignment = assignment));
      }
    });
  }

  exportDB() {
    this.assignmentsService.exportAssignments();
  }

  importDB(blob: Blob) {
    let translations = this.translateService.instant([
      "SUCCESS",
      "ERROR",
      "IMPORT-SUCCESS",
      "IMPORT-ERROR",
    ]);
    this.assignmentsService
      .importAssignments(blob)
      .then(() => {
        this.loadAssignments();
        this.toastService.success(
          translations["SUCCESS"],
          translations["IMPORT-SUCCESS"]
        );
      })
      .catch((err) => {
        this.toastService.error(
          translations["ERROR"],
          translations["IMPORT-ERROR"] + " : " + err
        );
      });
  }

  changeListener($event): void {
    let file = $event.target.files[0];
    if (file) {
      this.openImportConfirmation().then(
        () => this.importDB(file),
        () => {}
      );
    }
  }

  openImportConfirmation(): Promise<any> {
    this.modalRef = this.modalService.open(this.importConfirmation);
    return this.modalRef.result;
  }

  toggleExpandRow(row) {
    this.table.rowDetail.toggleExpandRow(row);
  }


  toggleExpandGroup(group) {
    this.table.groupHeader.toggleExpandGroup(group);
  }

  /**
   * Concatenate questionsChecker(), startDateChecker(), endDateChecker() and getNumberOfRespository() be displayed in the template
   * @param row 
   * @returns String
   */
  detailDisplayer(row) : String {
    let nbRepos = this.getNumberOfRespository(row);
    let questions = this.questionsChecker(row);
    let startDate = this.startDateChecker(row);
    let endDate = this.endDateChecker(row);
    var resultAsString = `${nbRepos}     ${questions}\n${startDate}     ${endDate}`;
    return resultAsString;
  }

  /**
   * Check if there is any questions. If yes, question are convert into a string. If no, display the fact that there is no question.
   * @param row 
   * @returns String
   */
  private questionsChecker(row) : String {
    let resultAsString = (row.metadata.questions.length !== 0 )? "Question : " + row.metadata.questions.join(", "): "";
    return resultAsString;
  }

  /**
   * Check if there is a start date and format it. Return a string with dd/mm/yyyy format
   * @param row 
   * @returns String
   */
  private startDateChecker(row) : String {
    let startDateTranslate = this.translateService.instant("ASSIGNMENT-CHOOSER.ASSIGNMENT-DETAILS.START-DATE");
    let formatDate = this.datePipe.transform(row.metadata.startDate, this.translateService.instant("ASSIGNMENT-CHOOSER.ASSIGNMENT-DETAILS.FORMAT-DATE"));
    let resultAsString = (row.metadata.startDate)? startDateTranslate + " : " + formatDate : startDateTranslate + " : " + formatDate;
    return resultAsString;
  }
  
  /**
   * Check if there is a end date and format it. Return a string with dd/mm/yyyy format
   * @param row 
   * @returns String
   */
  private endDateChecker(row) : String {
    let endDateTranslate = this.translateService.instant("ASSIGNMENT-CHOOSER.ASSIGNMENT-DETAILS.END-DATE");
    let formatDate = this.datePipe.transform(row.metadata.endDate, this.translateService.instant("ASSIGNMENT-CHOOSER.ASSIGNMENT-DETAILS.FORMAT-DATE"));
    let resultAsString = (row.metadata.endDate)? endDateTranslate + " : " + formatDate: endDateTranslate + " : " + formatDate;
    return resultAsString;
  }

  /**
   * Return a String with the number of respository.
   * @param row 
   * @returns String
   */
  private getNumberOfRespository(row) : String {
    let NumberOfRespositoryTranslate = this.translateService.instant("ASSIGNMENT-CHOOSER.ASSIGNMENT-DETAILS.NUMBER-OF-RESPOSITORY");
    let resultAsString = (row.repositories.length > 0 || row.repositories.length)? NumberOfRespositoryTranslate + " : " + row.repositories.length: "";
    return resultAsString;
  }
  
  get modeView () {
    return this._modeView;
  }

  set modeView (modeView: String) {
    this._modeView = modeView;
  }

  switchModeView() {
    switch(this.modeView) {
      case "groupMode" :
        this.modeView = "detailsMode";
        this.initContentTable();
        break;
      case "detailsMode" :
        this.modeView = "groupMode";
        this.initContentTable();
        this.openFirstGroup();
        break;
      case "defaultMode" :
        this.modeView = "groupMode";
        this.initContentTable();
        
        break;
      default :
        this.modeView = "groupMode";
    }
  }

}

