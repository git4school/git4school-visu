import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, HostListener, ChangeDetectorRef } from "@angular/core";
import { QuestionClosingMode } from "@models/Metadata.model";
import { OverlayManagerService, OverlayType } from "@services/overlay-manager.service";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

@Component({
  selector: "app-questions-assistant-popover",
  templateUrl: "./questions-assistant-popover.component.html",
  styleUrls: ["./questions-assistant-popover.component.scss"],
})
export class QuestionsAssistantPopoverComponent implements OnInit, OnDestroy {
  @Input() closingMode: QuestionClosingMode = "standard";
  @Output() closingModeChange = new EventEmitter<QuestionClosingMode>();

  @Input() public customClosingKeywords: string[] = [];
  @Output() public customClosingKeywordsChange = new EventEmitter<string[]>();

  @Output() public addQuestions = new EventEmitter<string[]>();

  public isOpen = false;
  public isDropUp = false;

  public sequencePrefix = "question ";
  public sequenceType: "numeric" | "alpha" = "numeric";
  public sequenceStartStr = "1";
  public sequenceEndStr = "5";
  public sequenceStartAlpha = "A";
  public sequenceEndAlpha = "E";

  public customKeywordsText = "";

  public closingModeOptions = [
    { value: "standard", label: "QUESTIONS-ASSISTANT.MODE_STANDARD_SHORT" },
    { value: "custom", label: "QUESTIONS-ASSISTANT.MODE_CUSTOM_SHORT" },
    { value: "none", label: "QUESTIONS-ASSISTANT.MODE_NONE_SHORT" },
  ];

  public sequenceTypeOptions = [
    { value: "numeric", label: "123" },
    { value: "alpha", label: "ABC" },
  ];

  public get isCustomRuleActive(): boolean {
    return this.closingMode !== "standard";
  }

  public get tooltipKey(): string {
    if (this.closingMode === "none") {
      return "QUESTIONS-ASSISTANT.TOOLTIP_CLOSING_NONE";
    }
    if (this.closingMode === "custom") {
      return "QUESTIONS-ASSISTANT.TOOLTIP_CLOSING_CUSTOM";
    }
    return "QUESTIONS-ASSISTANT.TOOLTIP_CLOSING_STANDARD";
  }

  public get customKeywordsDisplay(): string {
    return (this.customClosingKeywords || []).join(", ");
  }

  public get allGeneratedQuestions(): string[] {
    return this.computeSequence();
  }

  private destroy$ = new Subject<void>();
  private resizeObserver: any = null;
  private boundScroll: (() => void) | null = null;
  private boundResize: (() => void) | null = null;

  constructor(private elementRef: ElementRef, private cdr: ChangeDetectorRef, private overlayManagerService: OverlayManagerService) {}

  @HostListener("document:click", ["$event"])
  public onDocumentClick(event: MouseEvent): void {
    if (this.isOpen && !this.elementRef.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  @HostListener("keydown.escape")
  public onEscape(): void {
    if (this.isOpen) {
      this.close();
    }
  }

  public ngOnInit(): void {
    if (this.customClosingKeywords && this.customClosingKeywords.length > 0) {
      this.customKeywordsText = this.customClosingKeywords.join(", ");
    }

    this.overlayManagerService.dismiss$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.isOpen) {
        this.close();
      }
    });

    this.boundScroll = () => {
      if (this.isOpen) {
        this.adjustPosition();
      }
    };
    this.boundResize = () => {
      if (this.isOpen) {
        this.adjustPosition();
      }
    };
    document.addEventListener("scroll", this.boundScroll, { capture: true, passive: true });
    window.addEventListener("resize", this.boundResize, { passive: true });
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.boundScroll) {
      document.removeEventListener("scroll", this.boundScroll, { capture: true });
    }
    if (this.boundResize) {
      window.removeEventListener("resize", this.boundResize);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  public togglePopover(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    if (this.isOpen) {
      this.close();
    } else {
      this.overlayManagerService.dismiss(OverlayType.DROPDOWN);
      this.isOpen = true;
      if (this.customClosingKeywords && this.customClosingKeywords.length > 0) {
        this.customKeywordsText = this.customClosingKeywords.join(", ");
      }
      this.cdr.detectChanges();
      this.adjustPosition();

      const popupEl = this.elementRef.nativeElement.querySelector(".assistant-popover-card") as HTMLElement;
      if (popupEl && typeof (window as any).ResizeObserver !== "undefined") {
        if (this.resizeObserver) {
          this.resizeObserver.disconnect();
        }
        this.resizeObserver = new (window as any).ResizeObserver(() => {
          this.adjustPosition();
        });
        this.resizeObserver.observe(popupEl);
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.adjustPosition();
        });
      });
    }
  }

  public close(): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.isDropUp = false;
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }
      this.cdr.markForCheck();
    }
  }

  public adjustPosition(): void {
    if (!this.isOpen) return;

    const popupEl = this.elementRef.nativeElement.querySelector(".assistant-popover-card") as HTMLElement;
    const triggerEl = this.elementRef.nativeElement.querySelector(".btn-assistant-trigger") as HTMLElement;
    if (!popupEl || !triggerEl) return;

    const triggerRect = triggerEl.getBoundingClientRect();
    const popupWidth = popupEl.offsetWidth || 380;
    const popupHeight = popupEl.offsetHeight || 370;

    const margin = 12;
    const gap = 6;
    const spaceBelow = window.innerHeight - triggerRect.bottom - margin;
    const spaceAbove = triggerRect.top - margin;

    let targetViewportY: number;

    if (spaceBelow >= popupHeight + gap) {
      targetViewportY = triggerRect.bottom + gap;
      this.isDropUp = false;
    } else if (spaceAbove >= popupHeight + gap) {
      targetViewportY = triggerRect.top - gap - popupHeight;
      this.isDropUp = true;
    } else {
      if (spaceBelow >= spaceAbove) {
        targetViewportY = triggerRect.bottom + gap;
        this.isDropUp = false;
      } else {
        targetViewportY = triggerRect.top - gap - popupHeight;
        this.isDropUp = true;
      }
      targetViewportY = Math.max(margin, Math.min(targetViewportY, window.innerHeight - popupHeight - margin));
    }

    let targetViewportX = triggerRect.left;
    if (targetViewportX + popupWidth > window.innerWidth - margin) {
      targetViewportX = window.innerWidth - popupWidth - margin;
    }
    if (targetViewportX < margin) {
      targetViewportX = margin;
    }

    const wrapperRect = this.elementRef.nativeElement.getBoundingClientRect();
    const relativeLeft = Math.round(targetViewportX - wrapperRect.left);
    const relativeTop = Math.round(targetViewportY - wrapperRect.top);

    popupEl.style.left = `${relativeLeft}px`;
    popupEl.style.top = `${relativeTop}px`;
    popupEl.style.right = "auto";
    popupEl.style.bottom = "auto";
    this.cdr.markForCheck();
  }

  public onApplySequence(): void {
    const generated = this.computeSequence();
    if (generated.length > 0) {
      this.addQuestions.emit(generated);
      this.close();
    }
  }

  public setClosingMode(mode: QuestionClosingMode): void {
    this.closingMode = mode;
    this.closingModeChange.emit(this.closingMode);
  }

  public onClosingModeChange(mode: QuestionClosingMode): void {
    this.closingMode = mode;
    this.closingModeChange.emit(this.closingMode);
    this.cdr.detectChanges();
    this.adjustPosition();
  }

  public onStartChange(val: string): void {
    if (this.sequenceType === "numeric") {
      this.sequenceStartStr = val;
    } else {
      this.sequenceStartAlpha = (val || "").toUpperCase();
    }
  }

  public onEndChange(val: string): void {
    if (this.sequenceType === "numeric") {
      this.sequenceEndStr = val;
    } else {
      this.sequenceEndAlpha = (val || "").toUpperCase();
    }
  }

  public onCustomKeywordsInputChange(text: string): void {
    this.customKeywordsText = text;
    const list = text
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    this.customClosingKeywords = list;
    this.customClosingKeywordsChange.emit(this.customClosingKeywords);
  }

  private computeSequence(): string[] {
    const result: string[] = [];
    const prefix = this.sequencePrefix !== undefined && this.sequencePrefix !== null ? this.sequencePrefix : "question ";

    if (this.sequenceType === "numeric") {
      const startStr = String(this.sequenceStartStr || "").trim();
      const endStr = String(this.sequenceEndStr || "").trim();

      if (!startStr && !endStr) return [];

      const startNum = parseInt(startStr, 10);
      const endNum = parseInt(endStr, 10);

      if (isNaN(startNum) || isNaN(endNum)) return [];

      let minPadding = 1;
      if (startStr.startsWith("0") && startStr.length > 1) {
        minPadding = Math.max(minPadding, startStr.length);
      }
      if (endStr.startsWith("0") && endStr.length > 1) {
        minPadding = Math.max(minPadding, endStr.length);
      }

      const min = Math.min(startNum, endNum);
      const max = Math.max(startNum, endNum);
      const isDescending = startNum > endNum;

      if (max - min > 500) {
        return [];
      }

      const numbers: number[] = [];
      for (let i = min; i <= max; i++) {
        numbers.push(i);
      }
      if (isDescending) {
        numbers.reverse();
      }

      numbers.forEach((num) => {
        const numStr = String(num).padStart(minPadding, "0");
        result.push(`${prefix}${numStr}`);
      });
    } else {
      const startChar = (this.sequenceStartAlpha || "A").trim().toUpperCase().charAt(0) || "A";
      const endChar = (this.sequenceEndAlpha || "E").trim().toUpperCase().charAt(0) || "E";
      const startCode = startChar.charCodeAt(0);
      const endCode = endChar.charCodeAt(0);
      const min = Math.min(startCode, endCode);
      const max = Math.max(startCode, endCode);
      const isDescending = startCode > endCode;

      if (max - min > 26) {
        return [];
      }

      const codes: number[] = [];
      for (let c = min; c <= max; c++) {
        codes.push(c);
      }
      if (isDescending) {
        codes.reverse();
      }

      codes.forEach((code) => {
        result.push(`${prefix}${String.fromCharCode(code)}`);
      });
    }

    return result;
  }
}
