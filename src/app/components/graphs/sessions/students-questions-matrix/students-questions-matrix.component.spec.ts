import { ComponentFixture, TestBed } from "@angular/core/testing";
import { StudentsQuestionsMatrixComponent } from "./students-questions-matrix.component";
import { TranslateModule } from "@ngx-translate/core";
import { AnonymizationService } from "@services/anonymization.service";
import { TooltipService } from "@services/tooltip.service";
import { Repository } from "@models/Repository.model";
import { Commit, CommitColor } from "@models/Commit.model";

describe("StudentsQuestionsMatrixComponent", () => {
  let component: StudentsQuestionsMatrixComponent;
  let fixture: ComponentFixture<StudentsQuestionsMatrixComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StudentsQuestionsMatrixComponent],
      imports: [TranslateModule.forRoot()],
      providers: [AnonymizationService, TooltipService],
    }).compileComponents();

    fixture = TestBed.createComponent(StudentsQuestionsMatrixComponent);
    component = fixture.componentInstance;
  });

  it("should create the matrix component", () => {
    expect(component).toBeTruthy();
  });

  it("should build rows and cells for repositories and questions", () => {
    const c1 = new Commit("close Q1", "alice", new Date("2025-04-11T14:00:00Z"), "url1", true, true, "Q1");
    c1.color = CommitColor.BEFORE;
    const r1 = new Repository("alice", "Alice", [c1], "B11");

    component.repositories = [r1];
    component.questions = ["Q1", "Q2"];
    component.ngOnChanges({
      repositories: {
        currentValue: [r1],
        previousValue: [],
        firstChange: true,
        isFirstChange: () => true,
      },
    });

    expect(component.rows.length).toBe(1);
    expect(component.rows[0].cells.length).toBe(2);
    expect(component.rows[0].cells[0].state).toBe("validated_before_review");
    expect(component.rows[0].cells[1].state).toBe("not_started");
  });
});
