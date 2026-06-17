import { Component, Input, Output, EventEmitter, OnDestroy, OnInit, ViewChild, ElementRef } from "@angular/core";
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
  @ViewChild("scrollContainer") scrollContainer: ElementRef;
  
  @Input() questions: string[] = [];
  @Input() questionSuggestions: string[] = [];
  @Input() editable = true;
  @Input() openOnFocus = false;
  @Input() noQuestionMessage = true;
  @Input() maxPillsWidth: string = '50%';
  @Input() commitMessages: string[] = [];
  @Output() commitMessagesChange = new EventEmitter<string[]>();
  
  disabled: boolean;

  question: string;
  items: { type: 'question' | 'commit', value: string }[] = [];

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
    this.commitMessages = [...this.commitMessages];
    this.syncItemsFromInputs();
  }

  ngOnDestroy(): void {
    this.focus$.unsubscribe();
    this.click$.unsubscribe();
  }

  syncItemsFromInputs() {
    this.items = [];
    this.questions.forEach(q => this.items.push({ type: 'question', value: q }));
    this.commitMessages.forEach(c => this.items.push({ type: 'commit', value: c }));
  }

  scrollToEnd() {
    setTimeout(() => {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollLeft = this.scrollContainer.nativeElement.scrollWidth;
      }
    }, 0);
  }

  addQuestion(text: string) {
    if (!text) return;
    
    // Check if it's already added
    if (this.questions.includes(text) || this.commitMessages.includes(text)) {
      this.question = null;
      return;
    }

    let type: 'question' | 'commit' = 'question';
    
    if (!this.editable) {
        if (this.questionSuggestions && this.questionSuggestions.length > 0) {
             const isSuggestion = this.questionSuggestions.some(s => s.toLowerCase() === text.toLowerCase());
             if (!isSuggestion) {
                 type = 'commit';
             }
        } else {
             type = 'commit';
        }
    }

    if (type === 'question') {
        this.questions = [...this.questions, text];
        this.onChange(this.questions);
    } else {
        this.commitMessages = [...this.commitMessages, text];
        this.commitMessagesChange.emit(this.commitMessages);
    }

    this.items.push({ type, value: text });
    this.question = null;
    this.scrollToEnd();
  }

  deleteItem(index: number) {
    const item = this.items[index];
    this.items.splice(index, 1);
    
    if (item.type === 'question') {
      this.questions = this.questions.filter(q => q !== item.value);
      this.onChange(this.questions);
    } else {
      this.commitMessages = this.commitMessages.filter(c => c !== item.value);
      this.commitMessagesChange.emit(this.commitMessages);
    }
  }

  onBackspace() {
    if (!this.question && this.items.length > 0) {
      this.deleteItem(this.items.length - 1);
    }
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
      this.questions = [...obj];
      // Re-sync items since questions changed externally
      this.syncItemsFromInputs();
      this.scrollToEnd();
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
