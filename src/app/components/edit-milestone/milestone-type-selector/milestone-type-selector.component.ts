import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-milestone-type-selector',
  templateUrl: './milestone-type-selector.component.html',
  styleUrls: ['./milestone-type-selector.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MilestoneTypeSelectorComponent),
      multi: true
    }
  ]
})
export class MilestoneTypeSelectorComponent implements ControlValueAccessor {
  @Input() isInvalid: boolean = false;
  @Input() errorMessage: string = '';

  value: string | null = null;
  hoveredValue: string | null = null;
  displayMode: 'pill' | 'lisere' = 'lisere';
  isDisabled: boolean = false;

  onChange = (value: string | null) => {};
  onTouched = () => {};

  types = [
    { value: 'corrections', label: 'CORRECTION' },
    { value: 'reviews', label: 'REVIEW' },
    { value: 'others', label: 'OTHER' }
  ];

  constructor() {}

  onGroupMouseEnter(): void {
    if (!this.isDisabled) {
      this.displayMode = 'pill';
    }
  }

  onGroupMouseLeave(): void {
    if (!this.isDisabled) {
      this.hoveredValue = null;
      this.displayMode = 'lisere';
    }
  }

  onButtonMouseEnter(type: string): void {
    if (!this.isDisabled) {
      this.hoveredValue = type;
      this.displayMode = 'pill';
    }
  }

  writeValue(obj: any): void {
    this.value = obj || null;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  selectType(typeValue: string): void {
    if (!this.isDisabled) {
      this.value = typeValue;
      this.onChange(this.value);
      this.onTouched();
      this.displayMode = 'lisere';
    }
  }
}
