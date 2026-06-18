import { Component, Input, Output, EventEmitter, OnDestroy, OnInit, ViewChild, ViewChildren, QueryList, ElementRef, HostListener } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";
import { NgbTypeahead } from "@ng-bootstrap/ng-bootstrap";
import { merge, Observable, Subject } from "rxjs";
import { filter, map } from "rxjs/operators";

export interface FilterGroup {
    criteria: { type: 'question' | 'commit', value: string, isExclusion?: boolean }[];
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
  @ViewChildren("connectorElements") connectorElements: QueryList<ElementRef>;
  
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
  items: { type: 'question' | 'commit', value: string, operatorAfter?: 'AND' | 'OR', isExclusion?: boolean, rawValue?: string }[] = [];

  selectedPillIndex: number | null = null;
  editingPillIndex: number | null = null;
  editingOldValue: string | null = null;
  editingOldType: 'question' | 'commit' | null = null;
  editingCurrentText: string = '';
  
  isTypingExclusion: boolean = false;
  editingIsExclusion: boolean = false;

  focus$ = new Subject<string>();
  click$ = new Subject<string>();
  editFocus$ = new Subject<string>();

  // Drag and Drop State
  draggedGroupStart: number | null = null;
  draggedGroupEnd: number | null = null;
  dropTargetIndex: number | null = null;
  dropPosition: 'left' | 'right' | null = null;

  trackByFn(index: number, item: any): any {
      return item;
  }

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

          if (event.key === 'ArrowLeft' && (event.metaKey || event.ctrlKey)) {
              const currentGroup = this.getGroupRange(this.selectedPillIndex);
              if (currentGroup.start > 0) {
                  const prevGroup = this.getGroupRange(currentGroup.start - 1);
                  this.animateAndSwap(currentGroup, prevGroup, 'left');
              }
              event.preventDefault();
              return;
          } else if (event.key === 'ArrowRight' && (event.metaKey || event.ctrlKey)) {
              const currentGroup = this.getGroupRange(this.selectedPillIndex);
              if (currentGroup.end < this.items.length - 1) {
                  const nextGroup = this.getGroupRange(currentGroup.end + 1);
                  this.animateAndSwap(currentGroup, nextGroup, 'right');
              }
              event.preventDefault();
              return;
          } else if (event.key === 'ArrowLeft') {
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
              
              if (!this.editable && event.key === '!') {
                  this.editingIsExclusion = true;
                  this.editingCurrentText = '';
              } else {
                  this.editingIsExclusion = false;
                  this.editingCurrentText = event.key;
              }
              
              this.items[this.selectedPillIndex].value = this.editingCurrentText;
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
    this.questions.forEach(q => {
        const isExclusion = !this.editable && q.startsWith('!');
        this.items.push({ 
            type: 'question', 
            value: isExclusion ? q.substring(1) : q, 
            isExclusion, 
            rawValue: q 
        });
    });
    this.commitMessages.forEach(c => {
        const isExclusion = !this.editable && c.startsWith('!');
        this.items.push({ 
            type: 'commit', 
            value: isExclusion ? c.substring(1) : c, 
            isExclusion, 
            rawValue: c 
        });
    });
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
    let cleanText = text;
    let isExclusion = this.isTypingExclusion;
    
    if (!this.editable) {
        if (text.startsWith('!')) {
            isExclusion = true;
            cleanText = text.substring(1);
        }
        
        if (this.questionSuggestions && this.questionSuggestions.length > 0) {
                const isSuggestion = this.questionSuggestions.some(s => s.toLowerCase() === cleanText.toLowerCase());
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

    this.items.push({ type, value: cleanText, isExclusion, rawValue: text });
    this.question = null;
    this.isTypingExclusion = false;
    this.scrollToEnd();
    this.emitFilterGroups();
  }

  deleteItem(index: number) {
    const item = this.items[index];
    if (item.type === 'question') {
        const idx = this.questions.indexOf(item.rawValue || item.value);
        if (idx !== -1) {
            this.questions.splice(idx, 1);
            this.questions = [...this.questions];
        }
        this.onChange(this.questions);
    } else {
        const idx = this.commitMessages.indexOf(item.rawValue || item.value);
        if (idx !== -1) {
            this.commitMessages.splice(idx, 1);
            this.commitMessages = [...this.commitMessages];
        }
        this.commitMessagesChange.emit(this.commitMessages);
    }
    
    // Handle AND operator links when deleting from a merged group
    if (index > 0 && this.items[index - 1].operatorAfter === 'AND' && (!item.operatorAfter || item.operatorAfter === 'OR')) {
        // Deleting the last item of a group: remove the AND from the previous item
        this.items[index - 1].operatorAfter = 'OR';
    }

    this.items.splice(index, 1);
    this.emitFilterGroups();
  }

  onBackspace() {
    if (!this.question && this.items.length > 0) {
      this.deleteItem(this.items.length - 1);
    }
  }

  onMainInputKeyDown(event: KeyboardEvent) {
      if (!this.question) {
          if (event.key === 'Backspace') {
              if (this.isTypingExclusion) {
                  this.isTypingExclusion = false;
                  event.preventDefault();
              } else if (this.items.length > 0) {
                  this.deleteItem(this.items.length - 1);
                  event.preventDefault();
              }
          } else if (event.key === 'ArrowLeft' && this.items.length > 0) {
              if (!this.isTypingExclusion) {
                  if (this.instance && this.instance.isPopupOpen()) {
                      this.instance.dismissPopup();
                  }
                  this.selectedPillIndex = this.items.length - 1;
                  event.stopPropagation();
                  this.scrollToSelectedPill();
                  this.focusSelectedPill();
                  event.preventDefault();
              }
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
          item.isExclusion = this.editingIsExclusion;
          item.rawValue = newValue;
          
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
      this.editingIsExclusion = false;
      this.emitFilterGroups();
  }

  get isMainPillActive(): boolean {
      return (this.question && this.question.length > 0) || this.isTypingExclusion;
  }

  onQuestionChange(value: string) {
      this.question = value;
      if (!this.editable && value && value.startsWith('!')) {
          this.isTypingExclusion = true;
          setTimeout(() => this.question = value.substring(1));
      }
  }

  onEditQuestionChange(value: string) {
      this.editingCurrentText = value;
      if (!this.editable && value && value.startsWith('!')) {
          this.editingIsExclusion = true;
          setTimeout(() => this.editingCurrentText = value.substring(1));
      } else if (value.length === 0) {
          // Keep exclusion state if we just backspaced everything but didn't remove the exclusion flag yet?
          // Or user requested "dès la première lettre, on oublie l'exclusion". This is handled on keydown.
      }
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

  // ============================================
  // Drag and Drop Logic
  // ============================================

  getGroupRange(index: number): { start: number, end: number } {
      let start = index;
      while (start > 0 && this.items[start - 1].operatorAfter === 'AND') {
          start--;
      }
      let end = index;
      while (end < this.items.length - 1 && this.items[end].operatorAfter === 'AND') {
          end++;
      }
      return { start, end };
  }

  onDragStart(event: DragEvent, index: number) {
      if (this.editingPillIndex !== null) {
          event.preventDefault();
          return;
      }
      
      const range = this.getGroupRange(index);
      this.draggedGroupStart = range.start;
      this.draggedGroupEnd = range.end;

      if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          // Hack to create a ghost image of the whole group
          if (this.pillElements) {
              const pillElements = this.pillElements.toArray();
              const ghostContainer = document.createElement('div');
              ghostContainer.style.position = 'absolute';
              ghostContainer.style.top = '-1000px';
              ghostContainer.style.display = 'flex';
              ghostContainer.style.alignItems = 'center';
              
              for (let i = range.start; i <= range.end; i++) {
                  if (pillElements[i]) {
                      const clone = pillElements[i].nativeElement.cloneNode(true) as HTMLElement;
                      clone.style.margin = '0';
                      if (i < range.end) {
                          clone.style.borderRight = '1px solid #cbd5e1';
                          clone.style.borderTopRightRadius = '0';
                          clone.style.borderBottomRightRadius = '0';
                      }
                      if (i > range.start) {
                          clone.style.borderTopLeftRadius = '0';
                          clone.style.borderBottomLeftRadius = '0';
                      }
                      ghostContainer.appendChild(clone);
                  }
              }
              
              document.body.appendChild(ghostContainer);
              event.dataTransfer.setDragImage(ghostContainer, event.offsetX || 20, event.offsetY || 20);
              
              setTimeout(() => {
                  document.body.removeChild(ghostContainer);
              }, 0);
          }
      }
  }

  getClosestPillIndex(clientX: number): { index: number, position: 'left' | 'right', leftPx: number } | null {
      if (!this.pillElements || this.pillElements.length === 0) return null;
      
      const pills = this.pillElements.toArray();
      const containerRect = this.scrollContainer.nativeElement.getBoundingClientRect();
      const scrollLeft = this.scrollContainer.nativeElement.scrollLeft;

      let closestDistance = Infinity;
      let closestResult: { index: number, position: 'left' | 'right', leftPx: number } | null = null;
      
      for (let i = 0; i < pills.length; i++) {
          const rect = pills[i].nativeElement.getBoundingClientRect();
          const relativeLeft = rect.left - containerRect.left + scrollLeft;
          const relativeRight = rect.right - containerRect.left + scrollLeft;
          
          // Check left side
          const distLeft = Math.abs(clientX - rect.left);
          if (distLeft < closestDistance) {
              closestDistance = distLeft;
              closestResult = { index: i, position: 'left', leftPx: relativeLeft - 6 };
          }
          
          // Check right side
          const distRight = Math.abs(clientX - rect.right);
          if (distRight < closestDistance) {
              closestDistance = distRight;
              closestResult = { index: i, position: 'right', leftPx: relativeRight + 6 };
          }
      }
      
      // Normalize to always use 'left' of the next element, to prevent ghost preview flickering
      if (closestResult && closestResult.position === 'right' && closestResult.index < pills.length - 1) {
          closestResult = { index: closestResult.index + 1, position: 'left', leftPx: closestResult.leftPx };
      }
      
      return closestResult;
  }

  onContainerDragOver(event: DragEvent) {
      event.preventDefault(); // Necessary to allow dropping
      if (this.draggedGroupStart === null || this.draggedGroupEnd === null) return;
      if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'move';
      }

      const closest = this.getClosestPillIndex(event.clientX);
      if (!closest) {
          this.dropTargetIndex = null;
          this.dropPosition = null;
          return;
      }

      // Check if dragging over itself
      if (closest.index >= this.draggedGroupStart && closest.index <= this.draggedGroupEnd) {
          this.dropTargetIndex = null;
          this.dropPosition = null;
          return;
      }

      const targetRange = this.getGroupRange(closest.index);
      
      this.dropTargetIndex = closest.position === 'left' ? targetRange.start : targetRange.end;
      this.dropPosition = closest.position;
      
      // If dropping inside a group but closest is an internal boundary, we must snap to the group boundary
      if (closest.position === 'left') {
          // snap to left of targetRange.start
      } else {
          // snap to right of targetRange.end
      }
  }

  onContainerDragLeave(event: DragEvent) {
      if (!this.scrollContainer) return;
      const rect = this.scrollContainer.nativeElement.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
          this.dropTargetIndex = null;
          this.dropPosition = null;
      }
  }

  getDraggedItems() {
      if (this.draggedGroupStart === null || this.draggedGroupEnd === null) return [];
      return this.items.slice(this.draggedGroupStart, this.draggedGroupEnd + 1);
  }

  onContainerDrop(event: DragEvent) {
      event.preventDefault();
      this.onDrop(event);
  }

  onDrop(event: DragEvent) {
      if (this.draggedGroupStart === null || this.draggedGroupEnd === null || this.dropTargetIndex === null || this.dropPosition === null) {
          this.onDragEnd();
          return;
      }

      // Calculate insert index
      let insertIndex = this.dropPosition === 'left' ? this.dropTargetIndex : this.dropTargetIndex + 1;
      
      // If dropping after itself, adjust index
      if (insertIndex > this.draggedGroupEnd) {
          insertIndex -= (this.draggedGroupEnd - this.draggedGroupStart + 1);
      } else if (insertIndex > this.draggedGroupStart && insertIndex <= this.draggedGroupEnd) {
          this.onDragEnd();
          return;
      }

      // Extract the dragged group
      const draggedItems = this.items.splice(this.draggedGroupStart, this.draggedGroupEnd - this.draggedGroupStart + 1);
      
      if (draggedItems.length > 0) {
          draggedItems[draggedItems.length - 1].operatorAfter = 'OR';
      }

      // Insert at new position
      this.items.splice(insertIndex, 0, ...draggedItems);

      this.rebuildDataArrays();
      this.emitFilterGroups();
      this.onDragEnd();
  }

  onDragEnd() {
      this.draggedGroupStart = null;
      this.draggedGroupEnd = null;
      this.dropTargetIndex = null;
      this.dropPosition = null;
  }

  animateAndSwap(group1: {start: number, end: number}, group2: {start: number, end: number}, direction: 'left' | 'right') {
      const pillEls = this.pillElements.toArray().map(el => el.nativeElement as HTMLElement);
      const connEls = this.connectorElements ? this.connectorElements.toArray().map(el => el.nativeElement as HTMLElement) : [];
      
      const group1StartRect = pillEls[group1.start].getBoundingClientRect();
      const group1EndRect = pillEls[group1.end].getBoundingClientRect();
      const group2StartRect = pillEls[group2.start].getBoundingClientRect();
      const group2EndRect = pillEls[group2.end].getBoundingClientRect();

      const group1Left = group1StartRect.left;
      const group1Right = group1EndRect.right;
      const group2Left = group2StartRect.left;
      const group2Right = group2EndRect.right;

      let move1 = 0;
      let move2 = 0;
      if (direction === 'left') {
          const distanceBetween = group1Left - group2Right;
          const group1Width = group1Right - group1Left;
          const group2Width = group2Right - group2Left;
          
          move1 = -(group2Width + distanceBetween);
          move2 = group1Width + distanceBetween;
      } else {
          const distanceBetween = group2Left - group1Right;
          const group1Width = group1Right - group1Left;
          const group2Width = group2Right - group2Left;
          
          move1 = group2Width + distanceBetween;
          move2 = -(group1Width + distanceBetween);
      }

      for (let i = group1.start; i <= group1.end; i++) {
          pillEls[i].style.transition = 'transform 0.3s ease-in-out';
          pillEls[i].style.transform = `translateX(${move1}px)`;
          pillEls[i].style.zIndex = '10';
          if (i < group1.end && connEls[i]) {
              connEls[i].style.transition = 'transform 0.3s ease-in-out';
              connEls[i].style.transform = `translateX(${move1}px)`;
              connEls[i].style.zIndex = '10';
          }
      }
      for (let i = group2.start; i <= group2.end; i++) {
          pillEls[i].style.transition = 'transform 0.3s ease-in-out';
          pillEls[i].style.transform = `translateX(${move2}px)`;
          pillEls[i].style.zIndex = '9';
          if (i < group2.end && connEls[i]) {
              connEls[i].style.transition = 'transform 0.3s ease-in-out';
              connEls[i].style.transform = `translateX(${move2}px)`;
              connEls[i].style.zIndex = '9';
          }
      }
      
      setTimeout(() => {
          const allEls = [...pillEls.slice(group1.start, group1.end + 1), ...pillEls.slice(group2.start, group2.end + 1)];
          const allConns: HTMLElement[] = [];
          for (let i = group1.start; i < group1.end; i++) if (connEls[i]) allConns.push(connEls[i]);
          for (let i = group2.start; i < group2.end; i++) if (connEls[i]) allConns.push(connEls[i]);

          allEls.forEach(el => {
              el.style.transition = 'none';
              el.style.transform = '';
              el.style.zIndex = '';
          });
          allConns.forEach(el => {
              el.style.transition = 'none';
              el.style.transform = '';
              el.style.zIndex = '';
          });

          this.draggedGroupStart = group1.start;
          this.draggedGroupEnd = group1.end;
          this.dropTargetIndex = direction === 'left' ? group2.start : group2.end;
          this.dropPosition = direction === 'left' ? 'left' : 'right';
          
          const selectOffset = this.selectedPillIndex! - group1.start;
          
          this.onDrop(null as any);

          if (direction === 'left') {
              this.selectedPillIndex = group2.start + selectOffset;
          } else {
              this.selectedPillIndex = group1.start + (group2.end - group2.start + 1) + selectOffset;
          }
          
          setTimeout(() => {
             this.scrollToSelectedPill();
             this.focusSelectedPill();

             // Restore transition after DOM update
             allEls.forEach(el => { el.style.transition = ''; });
             allConns.forEach(el => { el.style.transition = ''; });
          }, 50);
      }, 300);
  }

  rebuildDataArrays() {
      this.questions = this.items.filter(i => i.type === 'question').map(i => i.value);
      this.commitMessages = this.items.filter(i => i.type === 'commit').map(i => i.value);
      this.onChange(this.questions);
      this.commitMessagesChange.emit(this.commitMessages);
  }

  // --- End Drag and Drop ---

  isCommitStyle(item: any, index: number) {
      if (this.editingPillIndex === index) {
          const textToEvaluate = this.editingCurrentText;
          const isSuggestion = this.questionSuggestions.some(s => s.toLowerCase() === textToEvaluate.toLowerCase());
          return !isSuggestion;
      }
      if (index === -2) {
          const textToEvaluate = item?.value || '';
          if (textToEvaluate.length === 0) return true;
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
      let currentGroup: { type: 'question' | 'commit', value: string, isExclusion?: boolean }[] = [];

      this.items.forEach((item, i) => {
          currentGroup.push({ type: item.type, value: item.value, isExclusion: item.isExclusion });
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
