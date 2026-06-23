import {
  Component,
  ElementRef,
  forwardRef,
  Input,
  OnInit,
  ViewChild
} from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

@Component({
  selector: "app-text-input",
  templateUrl: "./text-input.component.html",
  styleUrls: ["./text-input.component.scss"],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextInputComponent),
      multi: true
    }
  ]
})
export class TextInputComponent implements ControlValueAccessor, OnInit {
  @Input() label = "";
  @Input() helperText = "";
  @Input() type = "text";
  @Input() placeholder = " ";
  @Input() required = false;
  @Input() invalid = false;
  @Input() valid = false;
  @Input() id = "";

  @Input() suggestions: string[] = [];
  showSuggestions = false;
  filteredSuggestions: string[] = [];


  @ViewChild("inputElement", { static: false })
  inputElement: ElementRef<HTMLInputElement>;

  value = "";
  isFocused = false;
  isDisabled = false;

  onChange: any = () => {};
  onTouched: any = () => {};

  constructor(private el: ElementRef) {}

  ngOnInit(): void {}

  writeValue(value: any): void {
    if (value !== undefined) {
      this.value = value;
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.onChange(this.value);
    this.filterSuggestions();
  }

  filterSuggestions(): void {
    if (this.suggestions && this.suggestions.length > 0) {
      const query = (this.value || '').toLowerCase();
      this.filteredSuggestions = this.suggestions.filter(s => s.toLowerCase().includes(query));
      this.showSuggestions = true;
    } else {
      this.showSuggestions = false;
    }
  }

  selectSuggestion(suggestion: string): void {
    this.value = suggestion;
    this.onChange(this.value);
    this.showSuggestions = false;
    // Set focus back or keep it blurred? Typically we just hide it.
  }

  onFocus(): void {
    this.isFocused = true;
    this.filterSuggestions();
  }

  onBlur(): void {
    this.isFocused = false;
    this.onTouched();
    setTimeout(() => {
      this.showSuggestions = false;
    }, 200);
  }

  clearValue(): void {
    this.value = "";
    this.onChange(this.value);
    if (this.inputElement) {
      this.inputElement.nativeElement.focus();
    }
  }

  onEnter(event: KeyboardEvent): void {
    event.preventDefault();

    // Find all focusable inputs and textareas in the DOM
    const focusableElements = Array.from(
      document.querySelectorAll(
        "input:not([disabled]):not([type=\"hidden\"]):not([type=\"checkbox\"]):not([type=\"radio\"]), textarea:not([disabled])"
      )
    ) as HTMLElement[];

    // Filter out inputs that are inside ngbDatepicker popups or similar
    const validElements = focusableElements.filter((el) => {
      // Exclude elements inside ngb-datepicker to avoid jumping into the calendar
      return !el.closest("ngb-datepicker");
    });

    if (this.inputElement && this.inputElement.nativeElement) {
      const currentIndex = validElements.indexOf(
        this.inputElement.nativeElement
      );
      if (currentIndex > -1 && currentIndex < validElements.length - 1) {
        validElements[currentIndex + 1].focus();
      }
    }
  }

  get hasValue(): boolean {
    return this.value !== null && this.value !== undefined && this.value !== "";
  }
}
