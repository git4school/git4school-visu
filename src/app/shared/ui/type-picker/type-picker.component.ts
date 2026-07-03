import { Component, forwardRef, Input, ViewChildren, QueryList, ElementRef, AfterViewInit, HostListener, ChangeDetectorRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface TypePickerOption {
  value: string;
  label: string;
  color?: string; // e.g. 'var(--color-danger)'
}

@Component({
  selector: 'app-type-picker',
  templateUrl: './type-picker.component.html',
  styleUrls: ['./type-picker.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TypePickerComponent),
      multi: true
    }
  ]
})
export class TypePickerComponent implements ControlValueAccessor, AfterViewInit {
  @Input() options: TypePickerOption[] = [];
  @Input() wrapContent: boolean = false;
  @Input() isInvalid: boolean = false;
  @Input() errorMessage: string = '';

  @ViewChildren('btn') buttons!: QueryList<ElementRef>;

  value: string | null = null;
  hoveredOption: TypePickerOption | null = null;
  displayMode: 'pill' | 'lisere' = 'lisere';
  isDisabled: boolean = false;

  indicatorStyle: any = {
    opacity: 0,
    transform: 'translateX(0) scaleX(0)',
    width: '0px',
    backgroundColor: 'transparent'
  };

  onChange = (value: string | null) => {};
  onTouched = () => {};

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit() {
    setTimeout(() => this.updateIndicator(), 0);
  }

  @HostListener('window:resize')
  onResize() {
    this.updateIndicator();
  }

  onGroupMouseEnter(): void {
    if (!this.isDisabled) {
      this.displayMode = 'pill';
      this.updateIndicator();
    }
  }

  onGroupMouseLeave(): void {
    if (!this.isDisabled) {
      this.hoveredOption = null;
      this.displayMode = 'lisere';
      this.updateIndicator();
    }
  }

  onButtonMouseEnter(option: TypePickerOption, index: number): void {
    if (!this.isDisabled) {
      this.hoveredOption = option;
      this.displayMode = 'pill';
      this.updateIndicator();
    }
  }

  writeValue(obj: any): void {
    this.value = obj || null;
    this.updateIndicator();
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
      this.updateIndicator();
    }
  }

  get activeOption(): TypePickerOption | null {
    return this.options.find(o => o.value === this.value) || null;
  }

  getButtonStyle(option: TypePickerOption): any {
    const isHovered = this.displayMode === 'pill' && this.hoveredOption === option;
    const isActiveAndNotHoveredElsewhere = this.displayMode === 'pill' && !this.hoveredOption && this.value === option.value;
    const isPillOverThis = isHovered || isActiveAndNotHoveredElsewhere;

    if (isPillOverThis) {
      return { color: '#ffffff' };
    } else if (this.value === option.value) {
      return { color: option.color || 'var(--color-primary)' };
    }
    return {};
  }

  updateIndicator() {
    if (!this.buttons) return;

    const targetOption = (this.displayMode === 'pill' && this.hoveredOption) ? this.hoveredOption : this.activeOption;
    const targetBtn = targetOption ? this.buttons.toArray()[this.options.indexOf(targetOption)]?.nativeElement : null;

    if (!targetBtn) {
      this.indicatorStyle = { ...this.indicatorStyle, opacity: 0, transform: 'translateX(0) scaleX(0)' };
      this.cdr.markForCheck();
      return;
    }

    const isPill = this.displayMode === 'pill';
    this.indicatorStyle = {
      opacity: 1,
      width: `${targetBtn.offsetWidth}px`,
      transform: `translateX(${targetBtn.offsetLeft}px) scaleX(${isPill ? 1 : 0.6})`,
      backgroundColor: targetOption.color || 'var(--color-primary)',
      height: isPill ? '100%' : '3px',
      borderRadius: isPill ? '12px' : '4px 4px 0 0',
      bottom: isPill ? '0' : '-12px'
    };
    
    this.cdr.markForCheck();
  }
}
