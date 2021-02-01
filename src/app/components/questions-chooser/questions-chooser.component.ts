import { Component, Input, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";
import { NgbTypeahead } from "@ng-bootstrap/ng-bootstrap";
import { merge, Observable, Subject } from "rxjs";
import { filter, map } from "rxjs/operators";

@Component({
  selector: "questions-chooser",
  templateUrl: "./questions-chooser.component.html",
  styleUrls: ["./questions-chooser.component.scss"],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: QuestionsChooserComponent,
      multi: true,
    },
  ],
})
export class QuestionsChooserComponent
  implements OnInit, ControlValueAccessor, OnDestroy {
  @ViewChild("instance", { static: true }) instance: NgbTypeahead;
  @Input() questions: string[] = [];
  @Input() questionSuggestions: string[] = [];
  @Input() editable = true;
  @Input() openOnFocus = false;
  @Input() noQuestionMessage = true;
  disabled: boolean;

  question: string;

  focus$ = new Subject<string>();
  click$ = new Subject<string>();

  constructor() {}

  searchQuestions = (text: Observable<string>) => {
    const clicksWithClosedPopup$ = this.click$.pipe(
      filter(() => !this.instance.isPopupOpen())
    );
    const inputFocus$ = this.focus$;
    return merge(text, clicksWithClosedPopup$, inputFocus$).pipe(
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
  };

  ngOnInit(): void {
    this.disabled = false;
    this.questions = [...this.questions];
    this.questionSuggestions = [...this.questionSuggestions];
  }

  ngOnDestroy(): void {
    this.focus$.unsubscribe();
    this.click$.unsubscribe();
  }

  addQuestion(question: string) {
    if (question && !this.questions.includes(question)) {
      this.questions.push(question);
      this.question = null;
      this.onChange(this.questions);
    }
  }

  deleteQuestion(index: number) {
    this.questions.splice(index, 1);
    this.onChange(this.questions);
  }

  onEnter() {
    this.addQuestion(this.question);
  }

  onSelect(item) {
    this.addQuestion(item.item);
    item.preventDefault();
  }

  writeValue(obj: any): void {
    if (obj) {
      this.questions = obj;
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {}

  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  private onChange = (_: any) => {};
}
