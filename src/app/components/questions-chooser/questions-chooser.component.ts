import { Component, forwardRef, Input, OnInit } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Component({
  selector: "questions-chooser",
  templateUrl: "./questions-chooser.component.html",
  styleUrls: ["./questions-chooser.component.scss"],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => QuestionsChooserComponent),
      multi: true,
    },
  ],
  // changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestionsChooserComponent implements OnInit, ControlValueAccessor {
  @Input() questions: string[] = [];
  @Input() questionSuggestions: string[] = [];
  @Input() editable = true;
  @Input() openOnFocus = false;
  disabled: boolean;

  question: string;

  constructor() {}

  searchQuestions = (text: Observable<string>) =>
    text.pipe(
      map((search) =>
        this.questionSuggestions
          .filter(
            (question) =>
              !this.questions.includes(question) &&
              question.toLowerCase().indexOf(search.toLowerCase()) > -1
          )
          .slice(0, 10)
      )
    );

  ngOnInit(): void {
    this.disabled = false;
    this.questions = [...this.questions];
    this.questionSuggestions = [...this.questionSuggestions];
  }

  addQuestion(question: string) {
    if (question && !this.questions.includes(question)) {
      this.questions.push(question);
      this.question = null;
      this.propagateChange(this.questions);
    }
  }

  deleteQuestion(index: number) {
    this.questions.splice(index, 1);
    this.propagateChange(this.questions);
  }

  onEnter() {
    this.addQuestion(this.question);
  }

  writeValue(obj: any): void {
    if (obj) {
      this.questions = obj;
    }
  }

  registerOnChange(fn: any): void {
    this.propagateChange = fn;
  }

  registerOnTouched(fn: any): void {}

  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  private propagateChange = (_: any) => {};
}
