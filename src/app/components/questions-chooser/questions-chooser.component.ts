import { Component, Input, Output, EventEmitter, OnDestroy, OnInit, ViewChild, ViewChildren, QueryList, ElementRef, HostListener } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";
import { NgbTypeahead } from "@ng-bootstrap/ng-bootstrap";
import { merge, Observable, Subject } from "rxjs";
import { filter, map } from "rxjs/operators";

export interface FilterGroup {
    criteria: { type: 'question' | 'commit', value: string }[];
}

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
  @ViewChild("inputField", { static: true }) inputField: ElementRef;
  @ViewChildren("pillElements") pillElements: QueryList<ElementRef>;
  
  @Input() questions: string[] = [];
  @Input() questionSuggestions: string[] = [];
  @Input() editable = true;
  @Input() openOnFocus = false;
  @Input() noQuestionMessage = true;
  @Input() maxPillsWidth: string = '50%';
  @Input() commitMessages: string[] = [];
  @Output() commitMessagesChange = new EventEmitter<string[]>();
  @Output() filterGroupsChange = new EventEmitter<FilterGroup[]>();
  
  disabled: boolean;

  question: string;
  items: { type: 'question' | 'commit', value: string, operatorAfter?: 'AND' | 'OR' }[] = [];

  selectedPillIndex: number | null = null;
  editingPillIndex: number | null = null;
  editingOldValue: string | null = null;
  editingOldType: 'question' | 'commit' | null = null;
  editingCurrentText: string = '';

  focus$ = new Subject<string>();
  click$ = new Subject<string>();
  editFocus$ = new Subject<string>();

  constructor(private elementRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  clickout(event) {
    if(!this.elementRef.nativeElement.contains(event.target)) {
      if(this.instance && this.instance.isPopupOpen()) {
        this.instance.dismissPopup();
      }
      if (this.selectedPillIndex !== null) {
          if (this.editingPillIndex !== null) {
              this.finishEditing();
          }
          this.selectedPillIndex = null;
      }
    }
  }

  @HostListener('keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
      if (this.selectedPillIndex !== null) {
          if (this.editingPillIndex !== null) {
               return; // Let the editInput handle it
          }

          if (event.key === 'ArrowLeft') {
              this.selectedPillIndex = Math.max(0, this.selectedPillIndex - 1);
              this.scrollToSelectedPill();
              this.focusSelectedPill();
              event.preventDefault();
          } else if (event.key === 'ArrowRight') {
              if (this.selectedPillIndex === this.items.length - 1) {
                  this.selectedPillIndex = null;
                  this.inputField.nativeElement.focus();
              } else {
                  this.selectedPillIndex++;
                  this.scrollToSelectedPill();
                  this.focusSelectedPill();
              }
              event.preventDefault();
          } else if (event.key === 'Delete' || event.key === 'Backspace') {
              this.deleteItem(this.selectedPillIndex);
              if (this.items.length === 0) {
                  this.selectedPillIndex = null;
                  this.inputField.nativeElement.focus();
              } else {
                  this.selectedPillIndex = Math.min(this.selectedPillIndex, this.items.length - 1);
                  this.scrollToSelectedPill();
                  this.focusSelectedPill();
              }
              event.preventDefault();
          } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
              this.editingPillIndex = this.selectedPillIndex;
              this.editingOldValue = this.items[this.selectedPillIndex].value;
              this.editingOldType = this.items[this.selectedPillIndex].type;
              this.editingCurrentText = event.key;
              this.items[this.selectedPillIndex].value = event.key;
              setTimeout(() => {
                  if (this.editInputs && this.editInputs.length > 0) {
                      const input = this.editInputs.first.nativeElement;
                      input.focus();
                      this.editFocus$.next(this.editingCurrentText);
                  }
              });
              event.preventDefault();
          }
      }
  }

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
              (!this.editable || !this.questions.includes(question)) &&
              question.toLowerCase().indexOf(search.toLowerCase()) > -1
          )
          .slice(0, 10)
      )
    );
  };

  searchQuestionsEdit = (text: Observable<string>) => {
    return merge(text, this.editFocus$).pipe(
      map((search) =>
        this.questionSuggestions
          .filter(
            (question) =>
              (!this.editable || !this.questions.includes(question) || question === this.editingOldValue) &&
              question.toLowerCase().indexOf((search || '').toLowerCase()) > -1
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

    this.inputField.nativeElement.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation(); // Stop ngbTypeahead from processing the Tab key
        if (this.instance.isPopupOpen()) {
          this.instance.dismissPopup();
        } else {
          this.click$.next(this.question || '');
        }
      }
    }, true); // Use capture phase
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
    
    // Check if it's already added in editable mode
    if (this.editable && (this.questions.includes(text) || this.commitMessages.includes(text))) {
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
    this.emitFilterGroups();
  }

  deleteItem(index: number) {
    const item = this.items[index];

    // Handle AND operator links when deleting from a merged group
    if (index > 0 && this.items[index - 1].operatorAfter === 'AND' && (!item.operatorAfter || item.operatorAfter === 'OR')) {
        // Deleting the last item of a group: remove the AND from the previous item
        this.items[index - 1].operatorAfter = 'OR';
    }
    // If this item had AND linking to next, and previous also had AND to this,
    // the previous keeps its AND to now point at the next item (chain stays)

    this.items.splice(index, 1);
    
    if (item.type === 'question') {
      const idx = this.questions.indexOf(item.value);
      if (idx !== -1) {
          this.questions.splice(idx, 1);
          this.questions = [...this.questions];
      }
      this.onChange(this.questions);
    } else {
      const idx = this.commitMessages.indexOf(item.value);
      if (idx !== -1) {
          this.commitMessages.splice(idx, 1);
          this.commitMessages = [...this.commitMessages];
      }
      this.commitMessagesChange.emit(this.commitMessages);
    }
    this.emitFilterGroups();
  }

  onBackspace() {
    if (!this.question && this.items.length > 0) {
      this.deleteItem(this.items.length - 1);
    }
  }

  onMainInputKeyDown(event: KeyboardEvent) {
      if (!this.question && this.items.length > 0) {
          if (event.key === 'ArrowLeft') {
              if (this.instance && this.instance.isPopupOpen()) {
                  this.instance.dismissPopup();
              }
              this.selectedPillIndex = this.items.length - 1;
              event.stopPropagation();
              this.scrollToSelectedPill();
              this.focusSelectedPill();
              event.preventDefault();
          } else if (event.key === 'Backspace') {
              this.deleteItem(this.items.length - 1);
              event.preventDefault();
          }
      }
  }

  onInputFocus(event: any) {
      this.focus$.next(event.target.value);
      if (this.selectedPillIndex !== null) {
          if (this.editingPillIndex !== null) this.finishEditing();
          this.selectedPillIndex = null;
      }
  }

  selectPill(index: number, event: MouseEvent) {
      if (this.editingPillIndex !== null && this.editingPillIndex !== index) {
          this.finishEditing();
      }
      this.selectedPillIndex = index;
      this.focusSelectedPill();
      event.stopPropagation();
  }

  onCloseClick(index: number, event: MouseEvent) {
      // Find the start of the merged group
      let start = index;
      while (start > 0 && this.items[start - 1].operatorAfter === 'AND') {
          start--;
      }
      
      // Delete from back to front to avoid index shifting during delete
      for (let i = index; i >= start; i--) {
          this.deleteItem(i);
      }
      
      if (this.selectedPillIndex !== null) {
          if (this.items.length === 0) {
              this.selectedPillIndex = null;
              this.inputField.nativeElement.focus();
          } else {
              this.selectedPillIndex = Math.min(this.selectedPillIndex, this.items.length - 1);
              this.focusSelectedPill();
          }
      }
      event.stopPropagation();
  }

  @ViewChildren("editInputs") editInputs: QueryList<ElementRef>;

  onEditBlur() {
      setTimeout(() => {
          this.finishEditing();
      }, 150);
  }

  onEditSelectItem(event: any) {
      this.editingCurrentText = event.item;
      this.finishEditing();
      this.focusSelectedPill();
      event.preventDefault();
  }

  onEditInputKeyDown(event: KeyboardEvent) {
      if (event.key === 'Enter') {
          setTimeout(() => {
              this.finishEditing();
              this.focusSelectedPill();
          });
      } else if (event.key === 'ArrowLeft') {
          this.finishEditing();
          this.selectedPillIndex = Math.max(0, this.selectedPillIndex - 1);
          this.scrollToSelectedPill();
          this.focusSelectedPill();
          event.preventDefault();
      } else if (event.key === 'ArrowRight') {
          this.finishEditing();
          if (this.selectedPillIndex === this.items.length - 1) {
              this.selectedPillIndex = null;
              this.inputField.nativeElement.focus();
          } else {
              this.selectedPillIndex++;
              this.scrollToSelectedPill();
              this.focusSelectedPill();
          }
          event.preventDefault();
      }
  }

  finishEditing() {
      if (this.editingPillIndex === null) return;
      
      const index = this.editingPillIndex;
      const item = this.items[index];
      const newValue = this.editingCurrentText.trim();
      
      if (this.editingOldType === 'question') {
          const idx = this.questions.indexOf(this.editingOldValue);
          if (idx !== -1) {
              this.questions.splice(idx, 1);
              this.questions = [...this.questions];
          }
      } else {
          const idx = this.commitMessages.indexOf(this.editingOldValue);
          if (idx !== -1) {
              this.commitMessages.splice(idx, 1);
              this.commitMessages = [...this.commitMessages];
          }
      }
      
      if (newValue === '' || (this.editable && (this.questions.includes(newValue) || this.commitMessages.includes(newValue)))) {
          this.items.splice(index, 1);
          if (this.selectedPillIndex >= this.items.length) {
              this.selectedPillIndex = this.items.length > 0 ? this.items.length - 1 : null;
              if (this.selectedPillIndex === null) {
                  this.inputField.nativeElement.focus();
              }
          }
      } else {
          const isSuggestion = this.questionSuggestions.some(s => s.toLowerCase() === newValue.toLowerCase());
          const newType = isSuggestion ? 'question' : 'commit';
          item.type = newType;
          item.value = newValue; 
          
          if (newType === 'question') {
              this.questions.push(newValue);
          } else {
              this.commitMessages.push(newValue);
          }
      }
      
      this.onChange(this.questions);
      this.commitMessagesChange.emit(this.commitMessages);
      
      this.editingPillIndex = null;
      this.editingOldValue = null;
      this.editingOldType = null;
      this.editingCurrentText = '';
      this.emitFilterGroups();
  }

  scrollToSelectedPill() {
      setTimeout(() => {
          if (this.selectedPillIndex !== null && this.pillElements) {
              const pillArray = this.pillElements.toArray();
              if (this.selectedPillIndex < pillArray.length) {
                  const pillElement = pillArray[this.selectedPillIndex].nativeElement;
                  const container = this.scrollContainer.nativeElement;
                  const containerRect = container.getBoundingClientRect();
                  const pillRect = pillElement.getBoundingClientRect();
                  
                  if (pillRect.left < containerRect.left) {
                      container.scrollLeft -= (containerRect.left - pillRect.left + 10);
                  } else if (pillRect.right > containerRect.right) {
                      container.scrollLeft += (pillRect.right - containerRect.right + 10);
                  }
              }
          }
      });
  }

  focusSelectedPill() {
      setTimeout(() => {
          if (this.selectedPillIndex !== null && this.pillElements && this.pillElements.length > this.selectedPillIndex) {
              this.pillElements.toArray()[this.selectedPillIndex].nativeElement.focus();
          }
      });
  }

  isCommitStyle(item: any, index: number) {
      if (this.editingPillIndex === index) {
          const textToEvaluate = this.editingCurrentText;
          const isSuggestion = this.questionSuggestions.some(s => s.toLowerCase() === textToEvaluate.toLowerCase());
          return !isSuggestion;
      }
      return item.type === 'commit';
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

  // --- Connector / AND-OR logic (filter mode only) ---

  toggleOperator(index: number, event: MouseEvent) {
      event.stopPropagation();
      const current = this.items[index].operatorAfter || 'OR';
      this.items[index].operatorAfter = current === 'OR' ? 'AND' : 'OR';
      this.emitFilterGroups();
  }

  emitFilterGroups() {
      if (this.editable) return; // Only in filter mode

      const groups: FilterGroup[] = [];
      let currentGroup: { type: 'question' | 'commit', value: string }[] = [];

      this.items.forEach((item, i) => {
          currentGroup.push({ type: item.type, value: item.value });
          if (item.operatorAfter !== 'AND' || i === this.items.length - 1) {
              groups.push({ criteria: [...currentGroup] });
              currentGroup = [];
          }
      });

      this.filterGroupsChange.emit(groups);
  }

  isMergedRight(index: number): boolean {
      return !this.editable && this.items[index]?.operatorAfter === 'AND';
  }

  isMergedLeft(index: number): boolean {
      return !this.editable && index > 0 && this.items[index - 1]?.operatorAfter === 'AND';
  }

  private onChange = (_: any) => {};
}
