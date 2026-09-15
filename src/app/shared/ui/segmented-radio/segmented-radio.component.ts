import {
  Component,
  Input,
  ViewChildren,
  QueryList,
  ElementRef,
  AfterViewInit,
  HostListener,
  HostBinding,
  ChangeDetectorRef,
  forwardRef,
  OnChanges,
  SimpleChanges,
} from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

export interface SegmentedRadioOption {
  value: string;
  label: string;
}

@Component({
  selector: "app-segmented-radio",
  templateUrl: "./segmented-radio.component.html",
  styleUrls: ["./segmented-radio.component.scss"],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SegmentedRadioComponent),
      multi: true,
    },
  ],
})
export class SegmentedRadioComponent implements ControlValueAccessor, AfterViewInit, OnChanges {
  @Input() public options: SegmentedRadioOption[] = [];
  @Input() public size: "sm" | "md" = "md";

  @HostBinding("class.size-sm")
  public get isSizeSm(): boolean {
    return this.size === "sm";
  }

  @ViewChildren("btn") public buttons!: QueryList<ElementRef>;

  public value: string | null = null;
  public isDisabled = false;

  public indicatorStyle: { opacity: number; transform: string; width: string } = {
    opacity: 0,
    transform: "translateX(0)",
    width: "0px",
  };

  private onChangeCallback: (value: string | null) => void;
  private onTouchedCallback: () => void;

  constructor(private cdr: ChangeDetectorRef) {
    this.onChangeCallback = () => {};
    this.onTouchedCallback = () => {};
  }

  @HostListener("window:resize")
  public onResize(): void {
    this.updateIndicator();
  }

  public ngAfterViewInit(): void {
    setTimeout(() => this.updateIndicator(), 0);
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.options) {
      setTimeout(() => this.updateIndicator(), 0);
    }
  }

  public writeValue(value: string | null): void {
    this.value = value;
    setTimeout(() => this.updateIndicator(), 0);
  }

  public registerOnChange(fn: (value: string | null) => void): void {
    this.onChangeCallback = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouchedCallback = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    this.cdr.markForCheck();
  }

  public selectOption(val: string): void {
    if (!this.isDisabled && this.value !== val) {
      this.value = val;
      this.onChangeCallback(this.value);
      this.onTouchedCallback();
      this.updateIndicator();
    }
  }

  public updateIndicator(): void {
    if (!this.buttons || this.buttons.length === 0) return;

    const index = this.options.findIndex((o) => o.value === this.value);
    const targetBtn = index >= 0 ? this.buttons.toArray()[index]?.nativeElement : null;

    if (!targetBtn) {
      this.indicatorStyle = {
        ...this.indicatorStyle,
        opacity: 0,
        transform: "translateX(0)",
      };
      this.cdr.markForCheck();
      return;
    }

    this.indicatorStyle = {
      opacity: 1,
      width: `${targetBtn.offsetWidth}px`,
      transform: `translateX(${targetBtn.offsetLeft}px)`,
    };

    this.cdr.markForCheck();
  }
}
