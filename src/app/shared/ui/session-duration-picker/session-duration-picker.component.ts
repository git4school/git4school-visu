import { Component, forwardRef, OnInit, ElementRef, ViewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NgbTimeStruct } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-session-duration-picker',
  templateUrl: './session-duration-picker.component.html',
  styleUrls: ['./session-duration-picker.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SessionDurationPickerComponent),
      multi: true
    }
  ]
})
export class SessionDurationPickerComponent implements ControlValueAccessor, OnInit {
  
  @ViewChild('customInput') customInput: ElementRef<HTMLInputElement>;
  
  // Internal state in minutes
  currentMinutes: number = 90;
  customMinutes: number = 150; // Default custom value
  
  // Standard preset options
  presets: number[] = [60, 90, 120];

  // ControlValueAccessor hooks
  private onChange: (value: NgbTimeStruct) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {}

  ngOnInit(): void {}

  // Convert NgbTimeStruct to total minutes
  private toMinutes(time: NgbTimeStruct): number {
    if (!time) return 0;
    return (time.hour || 0) * 60 + (time.minute || 0);
  }

  // Convert total minutes to NgbTimeStruct
  private toTimeStruct(minutes: number): NgbTimeStruct {
    return {
      hour: Math.floor(minutes / 60),
      minute: minutes % 60,
      second: 0
    };
  }

  // Called when the form model changes
  writeValue(value: NgbTimeStruct): void {
    if (value) {
      this.currentMinutes = this.toMinutes(value);
      if (!this.presets.includes(this.currentMinutes)) {
        this.customMinutes = this.currentMinutes;
      }
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
  
  setDisabledState(isDisabled: boolean): void {
    // Implement if needed
  }

  // User clicks a preset or the custom dial
  selectDuration(minutes: number): void {
    this.currentMinutes = minutes;
    this.emitChange();
  }
  
  selectCustom(): void {
    this.currentMinutes = this.customMinutes;
    this.emitChange();
    
    // Focus the input when clicking the custom dial
    setTimeout(() => {
      if (this.customInput) {
        this.customInput.nativeElement.focus();
        this.customInput.nativeElement.select();
      }
    });
  }

  onCustomInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value) && value > 0) {
      this.customMinutes = value;
      this.currentMinutes = value;
      this.emitChange();
    }
  }

  private emitChange(): void {
    this.onChange(this.toTimeStruct(this.currentMinutes));
    this.onTouched();
  }
  
  isCustomActive(): boolean {
    return !this.presets.includes(this.currentMinutes) || this.currentMinutes === this.customMinutes;
  }
}
