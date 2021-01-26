import { Component, Input, OnInit } from "@angular/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Component({
  selector: "questions-chooser",
  templateUrl: "./questions-chooser.component.html",
  styleUrls: ["./questions-chooser.component.scss"],
  // changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestionsChooserComponent implements OnInit {
  @Input() questions: string[] = [];
  @Input() questionSuggestions: string[] = [];
  @Input() editable = true;
  @Input() openOnFocus = false;

  question: string;

  constructor() {}

  searchQuestions = (text: Observable<string>) =>
    text.pipe(
      map((search) =>
        this.questionSuggestions
          .filter(
            (question) =>
              question.toLowerCase().indexOf(search.toLowerCase()) > -1
          )
          .slice(0, 10)
      )
    );

  ngOnInit(): void {
    this.questions = [...this.questions];
    this.questionSuggestions = [...this.questionSuggestions];
  }

  addQuestion(question: string) {
    if (question && !this.questions.includes(question)) {
      this.questions.push(question);
      this.question = null;
    }
  }

  deleteQuestion(index: number) {
    this.questions.splice(index, 1);
  }

  onEnter() {
    this.addQuestion(this.question);
  }
}
