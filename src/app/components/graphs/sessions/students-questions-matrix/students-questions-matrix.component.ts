import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  TemplateRef,
  ViewChild,
} from "@angular/core";
import { Commit, CommitColor } from "@models/Commit.model";
import { Milestone } from "@models/Milestone.model";
import { Repository } from "@models/Repository.model";
import { Session } from "@models/Session.model";
import { AnonymizationService } from "@services/anonymization.service";
import { TooltipService } from "@services/tooltip.service";

export type MatrixCellState = "validated_before_review" | "validated_after_correction" | "validated_late" | "in_progress" | "not_started";

export interface MatrixCellData {
  question: string;
  state: MatrixCellState;
  stateLabelKey: string;
  colorVar: string;
  commitsCount: number;
  inSessionCommitsCount: number;
  lastCommit?: Commit;
  closingCommit?: Commit;
  isClosedInSession: boolean;
}

export interface StudentMatrixRow {
  repository: Repository;
  studentName: string;
  tpGroup?: string;
  cells: MatrixCellData[];
  completedQuestionsCount: number;
  completionRate: number;
  inSessionQuestionsCount: number;
}

export interface QuestionColumnSummary {
  question: string;
  completedCount: number;
  completionRate: number;
  inSessionCompletedCount: number;
}

@Component({
  selector: "app-students-questions-matrix",
  templateUrl: "./students-questions-matrix.component.html",
  styleUrls: ["./students-questions-matrix.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentsQuestionsMatrixComponent implements OnChanges {
  @Input() repositories: Repository[] = [];
  @Input() questions: string[] = [];
  @Input() session?: Session;
  @Input() reviews: Milestone[] = [];
  @Input() corrections: Milestone[] = [];
  @Input() filterGroup?: string;

  @ViewChild("cellTooltipTemplate") cellTooltipTemplate!: TemplateRef<any>;

  public rows: StudentMatrixRow[] = [];
  public filteredRows: StudentMatrixRow[] = [];
  public columnSummaries: QuestionColumnSummary[] = [];
  public searchTerm = "";
  public scopeMode: "all" | "session" = "all";
  public sortBy: "name" | "progress" = "progress";

  constructor(public anonymizationService: AnonymizationService, private tooltipService: TooltipService, private cdr: ChangeDetectorRef) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.repositories || changes.questions || changes.session || changes.reviews || changes.corrections || changes.filterGroup) {
      this.computeMatrix();
    }
  }

  public onSearchChange(term: string): void {
    this.searchTerm = term.toLowerCase().trim();
    this.applyFiltersAndSort();
  }

  public setScopeMode(mode: "all" | "session"): void {
    if (this.scopeMode === mode) return;
    this.scopeMode = mode;
    this.applyFiltersAndSort();
  }

  public setSortBy(sort: "name" | "progress"): void {
    this.sortBy = sort;
    this.applyFiltersAndSort();
  }

  public onCellMouseEnter(event: MouseEvent, row: StudentMatrixRow, cell: MatrixCellData): void {
    const tooltipData = {
      studentName: row.studentName,
      tpGroup: row.tpGroup,
      question: cell.question,
      state: cell.state,
      stateLabelKey: cell.stateLabelKey,
      colorVar: cell.colorVar,
      commitsCount: cell.commitsCount,
      inSessionCommitsCount: cell.inSessionCommitsCount,
      isClosedInSession: cell.isClosedInSession,
      lastCommit: cell.lastCommit,
      closingCommit: cell.closingCommit,
    };

    this.tooltipService.showAtPosition(this.cellTooltipTemplate, event.clientX, event.clientY, "top", undefined, true, { tooltipData });
  }

  public onCellMouseLeave(): void {
    this.tooltipService.hide();
  }

  public onCellClick(cell: MatrixCellData): void {
    const commitUrl = cell.closingCommit?.url || cell.lastCommit?.url;
    if (commitUrl) {
      window.open(commitUrl, "_blank");
    }
  }

  private computeMatrix(): void {
    const repos = (this.repositories || []).filter((r) => {
      if (!this.filterGroup) return true;
      return r.tpGroup === this.filterGroup;
    });

    const questionsList = this.questions || [];
    const sessionStartMs = this.session?.startDate ? new Date(this.session.startDate).getTime() : 0;
    const sessionEndMs = this.session?.endDate ? new Date(this.session.endDate).getTime() : 0;

    this.rows = repos.map((repo) => {
      const studentName = this.anonymizationService.getDisplayName(repo) || repo.name || "Étudiant";
      const repoCommits = repo.commits || [];

      let completedCount = 0;
      let inSessionCompleted = 0;

      const cells: MatrixCellData[] = questionsList.map((q) => {
        const questionCommits = repoCommits.filter((c) => {
          if (!c.question) return false;
          return c.question.toLowerCase() === q.toLowerCase();
        });

        const closingCommit = questionCommits.find((c) => c.isCloture);
        const lastCommit = questionCommits.length > 0 ? questionCommits[questionCommits.length - 1] : undefined;

        let inSessionCount = 0;
        let isClosedInSession = false;

        questionCommits.forEach((c) => {
          const t = new Date(c.commitDate).getTime();
          if (sessionStartMs && sessionEndMs && t >= sessionStartMs && t <= sessionEndMs) {
            inSessionCount++;
            if (c.isCloture) isClosedInSession = true;
          }
        });

        let state: MatrixCellState = "not_started";
        let stateLabelKey = "SESSIONS-GRAPH.MATRIX.LEGEND_NOT_STARTED";
        let colorVar = "var(--color-border)";

        if (closingCommit) {
          completedCount++;
          if (isClosedInSession) inSessionCompleted++;

          if (closingCommit.color === CommitColor.BEFORE) {
            state = "validated_before_review";
            stateLabelKey = "SESSIONS-GRAPH.MATRIX.LEGEND_BEFORE";
            colorVar = "var(--color-success)";
          } else if (closingCommit.color === CommitColor.BETWEEN) {
            state = "validated_after_correction";
            stateLabelKey = "SESSIONS-GRAPH.MATRIX.LEGEND_BETWEEN";
            colorVar = "var(--color-warning)";
          } else {
            state = "validated_late";
            stateLabelKey = "SESSIONS-GRAPH.MATRIX.LEGEND_AFTER";
            colorVar = "var(--color-danger)";
          }
        } else if (questionCommits.length > 0) {
          state = "in_progress";
          stateLabelKey = "SESSIONS-GRAPH.MATRIX.LEGEND_IN_PROGRESS";
          colorVar = "var(--color-primary)";
        }

        return {
          question: q,
          state,
          stateLabelKey,
          colorVar,
          commitsCount: questionCommits.length,
          inSessionCommitsCount: inSessionCount,
          lastCommit,
          closingCommit,
          isClosedInSession,
        };
      });

      const completionRate = questionsList.length > 0 ? (completedCount / questionsList.length) * 100 : 0;

      return {
        repository: repo,
        studentName,
        tpGroup: repo.tpGroup,
        cells,
        completedQuestionsCount: completedCount,
        completionRate,
        inSessionQuestionsCount: inSessionCompleted,
      };
    });

    this.computeColumnSummaries(questionsList);
    this.applyFiltersAndSort();
  }

  private computeColumnSummaries(questionsList: string[]): void {
    const totalStudents = this.rows.length;
    this.columnSummaries = questionsList.map((q, idx) => {
      let completed = 0;
      let inSession = 0;

      this.rows.forEach((r) => {
        const cell = r.cells[idx];
        if (cell && cell.state !== "not_started" && cell.state !== "in_progress") {
          completed++;
          if (cell.isClosedInSession) inSession++;
        }
      });

      return {
        question: q,
        completedCount: completed,
        completionRate: totalStudents > 0 ? (completed / totalStudents) * 100 : 0,
        inSessionCompletedCount: inSession,
      };
    });
  }

  private applyFiltersAndSort(): void {
    let list = [...this.rows];

    if (this.searchTerm) {
      list = list.filter((r) => r.studentName.toLowerCase().includes(this.searchTerm));
    }

    if (this.sortBy === "progress") {
      list.sort((a, b) => {
        if (this.scopeMode === "session") {
          return b.inSessionQuestionsCount - a.inSessionQuestionsCount || b.completedQuestionsCount - a.completedQuestionsCount;
        }
        return b.completedQuestionsCount - a.completedQuestionsCount;
      });
    } else {
      list.sort((a, b) => a.studentName.localeCompare(b.studentName));
    }

    this.filteredRows = list;
    this.cdr.markForCheck();
  }
}
