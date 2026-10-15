import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  ChangeDetectorRef,
  OnChanges,
  SimpleChanges,
} from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import moment from "moment";
import { Subscription } from "rxjs";
import { ClockService } from "@services/clock.service";
import { computePopupPlacement } from "./popup-placement.util";
import { decideDateSelection, resolveQuickRange } from "./date-picker-actions.util";
import {
  buildCalendarWeeks,
  formatTypedFields,
  isHoveredEnd,
  isHoveredStart,
  isInsideRange,
  isRangeLeft,
  isRangeRight,
  isSelectedEnd,
  isSelectedStart,
  RangeState,
} from "./date-picker-state.util";
import {
  daysInMonth,
  DateField,
  fieldMaxLength,
  minutesToTime,
  orderPeriodTimes,
  padAndValidateDay,
  padMonth,
  padTimePart,
  parseTypedDate,
  sanitizeDateField,
  timeToMinutes,
} from "./date-input.util";

export interface CalendarDay {
  date: moment.Moment;
  day: number;
  isToday: boolean;
  isCurrentMonth: boolean;
}

@Component({
    selector: "app-date-range-picker",
    templateUrl: "./date-range-picker.component.html",
    styleUrls: ["./date-range-picker.component.scss"],
    standalone: false
})
export class DateRangePickerComponent implements OnInit, OnDestroy, OnChanges {
  @Input() startDate: Date | null = null;
  @Input() endDate: Date | null = null;
  @Input() mode: "date-range" | "date" | "datetime" | "datetime-period" = "date-range";
  @Input() startTime = "12:00";
  @Input() endTime = "14:00";
  @Input() defaultDuration = 120;
  @Output() periodChange = new EventEmitter<{ start: string; end: string }>();

  get isSingleDate(): boolean {
    return this.mode !== "date-range";
  }
  get hasTime(): boolean {
    return this.mode === "datetime" || this.mode === "datetime-period";
  }

  /** Popup wide enough for the clock picker (date + time side by side). */
  get isWidePopup(): boolean {
    return (this.isSingleDate && this.hasTime) || this.mode === "datetime-period";
  }
  @Input() date: Date | null = null;

  @Input() startLabel = "METADATA.START-DATE";
  @Input() endLabel = "METADATA.END-DATE";
  @Input() singleLabel = "DATE";

  @Output() startDateChange = new EventEmitter<Date | null>();
  @Output() endDateChange = new EventEmitter<Date | null>();
  @Output() dateChange = new EventEmitter<Date | null>();

  @ViewChild("startDay", { static: false }) startDayEl: ElementRef;
  @ViewChild("startMonth", { static: false }) startMonthEl: ElementRef;
  @ViewChild("startYear", { static: false }) startYearEl: ElementRef;
  @ViewChild("startHour", { static: false }) startHourEl: ElementRef;
  @ViewChild("startMinute", { static: false }) startMinuteEl: ElementRef;
  @ViewChild("endHour", { static: false }) endHourEl: ElementRef;
  @ViewChild("endMinute", { static: false }) endMinuteEl: ElementRef;
  @ViewChild("endDay", { static: false }) endDayEl: ElementRef;
  @ViewChild("endMonth", { static: false }) endMonthEl: ElementRef;
  @ViewChild("endYear", { static: false }) endYearEl: ElementRef;
  @ViewChild("calendarPopup", { static: false }) calendarPopupEl?: ElementRef<HTMLElement>;

  isOpen = false;
  dropUp = false;
  alignRight = false;
  viewDate: moment.Moment;
  hoverDate: moment.Moment | null = null;
  showTabSuggestion = false;
  tabSuggestionAbove = false;
  tabShortcutPressed = false;

  calendar: CalendarDay[][] = [];
  weekDays: string[] = [];

  // Used for typing dates in the input
  startDayStr = "";
  startMonthStr = "";
  startYearStr = "";
  startHourStr = "";
  startMinuteStr = "";
  endDayStr = "";
  endMonthStr = "";
  endYearStr = "";
  endHourStr = "";
  endMinuteStr = "";

  isFrench = false;

  private langSubscription: Subscription;
  private clockSubscription: Subscription;

  constructor(
    private elementRef: ElementRef,
    private translateService: TranslateService,
    private clockService: ClockService,
    private cdr: ChangeDetectorRef,
  ) {
    this.viewDate = this.clockService.moment();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["date"] && this.isSingleDate) {
      if (this.date) {
        this.viewDate = moment(this.date);
        this.updateInputStrings(true, moment(this.date));
      } else {
        this.updateInputStrings(true, null);
      }
    }

    if (this.mode === "datetime-period") {
      if (changes["startTime"] && this.startTime) {
        this.startHourStr = this.startTime.split(":")[0];
        this.startMinuteStr = this.startTime.split(":")[1];
      }
      if (changes["endTime"] && this.endTime) {
        this.endHourStr = this.endTime.split(":")[0];
        this.endMinuteStr = this.endTime.split(":")[1];
      }
    }

    if (!this.isSingleDate) {
      if (changes["startDate"]) {
        if (this.startDate) {
          this.viewDate = moment(this.startDate);
          this.updateInputStrings(true, moment(this.startDate));
        } else {
          this.updateInputStrings(true, null);
        }
      }
      if (changes["endDate"]) {
        if (this.endDate) {
          if (!this.startDate) this.viewDate = moment(this.endDate);
          this.updateInputStrings(false, moment(this.endDate));
        } else {
          this.updateInputStrings(false, null);
        }
      }
    }
  }

  ngOnInit(): void {
    this.updateLocale();
    this.langSubscription = this.translateService.onLangChange.subscribe(() => {
      this.updateLocale();
    });

    if (this.mode === "datetime-period") {
      if (this.startTime) {
        this.startHourStr = this.startTime.split(":")[0];
        this.startMinuteStr = this.startTime.split(":")[1];
      }
      if (this.endTime) {
        this.endHourStr = this.endTime.split(":")[0];
        this.endMinuteStr = this.endTime.split(":")[1];
      }
    }

    if (this.isSingleDate && this.date) {
      this.viewDate = moment(this.date);
      this.updateInputStrings(true, moment(this.date));
    }

    if (!this.isSingleDate) {
      if (this.startDate) {
        this.viewDate = moment(this.startDate);
        this.updateInputStrings(true, moment(this.startDate));
      }
      if (this.endDate) {
        if (!this.startDate) {
          this.viewDate = moment(this.endDate);
        }
        this.updateInputStrings(false, moment(this.endDate));
      }
    }

    this.generateCalendar();

    // Keep the "today" highlight in sync when the dev bar shifts the simulated clock
    this.clockSubscription = this.clockService.offsetMs$.subscribe(() => {
      this.generateCalendar();
      this.cdr.markForCheck();
    });

    // Use capture phase to bypass stopPropagation() called by modals
    document.addEventListener("click", this.onDocumentClick, { capture: true });
    document.addEventListener("scroll", this.onScroll, { capture: true, passive: true });
    window.addEventListener("resize", this.onWindowResize, { passive: true });
  }

  ngOnDestroy(): void {
    if (this.langSubscription) {
      this.langSubscription.unsubscribe();
    }
    if (this.clockSubscription) {
      this.clockSubscription.unsubscribe();
    }
    document.removeEventListener("click", this.onDocumentClick, { capture: true });
    document.removeEventListener("scroll", this.onScroll, { capture: true });
    window.removeEventListener("resize", this.onWindowResize);
  }

  get currentMonthName(): string {
    return this.viewDate.format("MMMM YYYY");
  }

  togglePopup() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.initViewDate();
      this.generateCalendar();
      this.cdr.detectChanges();
      this.adjustPopupPosition();
      // Double requestAnimationFrame for layout stability / dynamic instantiation as per GEMINI rules
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.adjustPopupPosition();
        });
      });
    } else {
      this.dropUp = false;
      this.alignRight = false;
    }
    this.cdr.markForCheck();
  }

  onEndHourFocus() {
    if (this.mode !== "datetime-period") return;

    // The floating suggestion replaces the calendar popup while editing the end time
    if (this.isOpen) {
      this.closePopup();
    }

    const endHourElement = this.endHourEl?.nativeElement as HTMLElement | undefined;
    this.tabSuggestionAbove = !!endHourElement && window.innerHeight - endHourElement.getBoundingClientRect().bottom < 80;
    this.showTabSuggestion = this.suggestedEndTime !== "";
  }

  private initViewDate(): void {
    if (this.mode === "datetime-period") {
      if (this.startTime) {
        this.startHourStr = this.startTime.split(":")[0];
        this.startMinuteStr = this.startTime.split(":")[1];
      }
      if (this.endTime) {
        this.endHourStr = this.endTime.split(":")[0];
        this.endMinuteStr = this.endTime.split(":")[1];
      }
    }

    if (this.isSingleDate && this.date) {
      this.viewDate = moment(this.date);
    } else if (!this.isSingleDate && this.startDate) {
      this.viewDate = moment(this.startDate);
    }
  }

  private adjustPopupPosition(): void {
    if (!this.isOpen) return;

    const popupEl = this.calendarPopupEl?.nativeElement || (this.elementRef.nativeElement.querySelector(".calendar-popup") as HTMLElement);
    if (!popupEl) return;

    const triggerRect = this.elementRef.nativeElement.getBoundingClientRect();
    const placement = computePopupPlacement({
      triggerRect,
      popupWidth: popupEl.offsetWidth || (this.isWidePopup ? 650 : 350),
      popupHeight: popupEl.offsetHeight || 390,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });

    this.dropUp = placement.dropUp;
    this.alignRight = placement.alignRight;

    // Convert viewport coordinates to relative offsets inside elementRef (which is position: relative)
    popupEl.style.left = `${placement.left}px`;
    popupEl.style.top = `${placement.top}px`;
    popupEl.style.right = "auto";
    popupEl.style.bottom = "auto";
  }

  private onScroll = () => {
    if (this.isOpen) {
      this.adjustPopupPosition();
    }
  };

  private onWindowResize = () => {
    if (this.isOpen) {
      this.adjustPopupPosition();
    }
  };

  closePopup() {
    if (this.isOpen) {
      this.isOpen = false;
      this.cdr.markForCheck();
    }
  }

  private onDocumentClick = (event: Event) => {
    if (this.isOpen && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closePopup();
    }
  };

  @HostListener("focusout", ["$event"])
  onFocusOut(event: FocusEvent) {
    const relatedTarget = event.relatedTarget as HTMLElement | null;
    // If relatedTarget is null, it means focus moved to a non-focusable element (e.g. clicking the page body).
    // The document:click listener handles outside clicks, so we only handle explicit focus moves here (like tabbing).
    if (relatedTarget && !this.elementRef.nativeElement.contains(relatedTarget)) {
      this.closePopup();
    }
  }

  nextMonth() {
    this.viewDate = this.viewDate.clone().add(1, "months");
    this.generateCalendar();
    requestAnimationFrame(() => this.adjustPopupPosition());
  }

  previousMonth() {
    this.viewDate = this.viewDate.clone().subtract(1, "months");
    this.generateCalendar();
    requestAnimationFrame(() => this.adjustPopupPosition());
  }

  onDateClick(day: CalendarDay) {
    const decision = decideDateSelection(day.date, {
      isSingleDate: this.isSingleDate,
      hasTime: this.hasTime,
      date: this.date,
      startDate: this.startDate,
      endDate: this.endDate,
    });

    if (decision.target === "single") {
      this.setSingleDate(decision.date);
    } else if (decision.target === "start") {
      this.setStartDate(decision.date);
      if (decision.clearOther) this.setEndDate(null);
      if (decision.swapWith) this.setEndDate(decision.swapWith);
    } else {
      this.setEndDate(decision.date);
      if (decision.swapWith) this.setStartDate(decision.swapWith);
    }

    if (decision.close) {
      this.closePopup();
    }
  }

  onDateHover(day: CalendarDay) {
    this.hoverDate = day.date;
  }

  onDateLeave() {
    this.hoverDate = null;
  }

  onPeriodChange(period: { start: string; end: string }) {
    this.showTabSuggestion = false;
    this.startTime = period.start;
    this.endTime = period.end;
    this.startHourStr = this.startTime.split(":")[0];
    this.startMinuteStr = this.startTime.split(":")[1];
    this.endHourStr = this.endTime.split(":")[0];
    this.endMinuteStr = this.endTime.split(":")[1];
    this.periodChange.emit(period);
  }

  onTimeChange(newTime: string) {
    if (!this.date) {
      // If no date is set, use today
      const today = this.clockService.moment().startOf("day");
      const [h, m] = newTime.split(":");
      today.hour(parseInt(h, 10)).minute(parseInt(m, 10));
      this.setSingleDate(today);
    } else {
      const updatedDate = moment(this.date);
      const [h, m] = newTime.split(":");
      updatedDate.hour(parseInt(h, 10)).minute(parseInt(m, 10));
      this.setSingleDate(updatedDate);
    }
  }

  get timeString(): string {
    if (!this.date) return "12:00";
    return moment(this.date).format("HH:mm");
  }

  get suggestedEndTime(): string {
    if (this.startHourStr.length !== 2 || this.startMinuteStr.length !== 2) return "";

    const endMinutes = timeToMinutes(`${this.startHourStr}:${this.startMinuteStr}`) + this.defaultDuration;
    // Keep the period within a single day, mirroring the clock picker behavior
    if (endMinutes >= 24 * 60) return "23:55";

    return minutesToTime(endMinutes);
  }

  isStartDate(date: moment.Moment): boolean {
    return isSelectedStart(this.rangeState, date);
  }

  isEndDate(date: moment.Moment): boolean {
    return isSelectedEnd(this.rangeState, date);
  }

  isInRange(date: moment.Moment): boolean {
    return isInsideRange(this.rangeState, date);
  }

  isRangeRight(date: moment.Moment): boolean {
    return isRangeRight(this.rangeState, date);
  }

  isRangeLeft(date: moment.Moment): boolean {
    return isRangeLeft(this.rangeState, date);
  }

  isHoverForwardEnd(date: moment.Moment): boolean {
    return isHoveredEnd(this.rangeState, date);
  }

  isHoverBackwardStart(date: moment.Moment): boolean {
    return isHoveredStart(this.rangeState, date);
  }

  setToday() {
    const today = resolveQuickRange("today", this.clockService.moment(), this.hasTime && this.isSingleDate).start;

    if (this.isSingleDate) {
      this.setSingleDate(today);
      if (this.mode === "datetime-period") {
        const endDate = today.clone().add(this.defaultDuration, "minutes");
        this.startTime = today.format("HH:mm");
        this.endTime = endDate.format("HH:mm");
        this.startHourStr = today.format("HH");
        this.startMinuteStr = today.format("mm");
        this.endHourStr = endDate.format("HH");
        this.endMinuteStr = endDate.format("mm");
        this.periodChange.emit({ start: this.startTime, end: this.endTime });
      }
    } else {
      this.setStartDate(today);
      this.setEndDate(today);
    }

    this.viewDate = today.clone();
    this.generateCalendar();
    this.closePopup();
  }

  setThisWeek() {
    const { start, end } = resolveQuickRange("week", this.clockService.moment());
    this.setStartDate(start);
    this.setEndDate(end);
    this.viewDate = start.clone();
    this.generateCalendar();
    this.closePopup();
  }

  setThisMonth() {
    const { start, end } = resolveQuickRange("month", this.clockService.moment());
    this.setStartDate(start);
    this.setEndDate(end);
    this.viewDate = start.clone();
    this.generateCalendar();
    this.closePopup();
  }

  private setFieldValue(isStart: boolean, field: "day" | "month" | "year" | "hour" | "minute", value: string) {
    if (isStart) {
      if (field === "day") this.startDayStr = value;
      else if (field === "month") this.startMonthStr = value;
      else if (field === "year") this.startYearStr = value;
      else if (field === "hour") this.startHourStr = value;
      else if (field === "minute") this.startMinuteStr = value;
    } else {
      if (field === "day") this.endDayStr = value;
      else if (field === "month") this.endMonthStr = value;
      else if (field === "year") this.endYearStr = value;
      else if (field === "hour") this.endHourStr = value;
      else if (field === "minute") this.endMinuteStr = value;
    }
  }

  onInputType(event: Event, isStart: boolean, field: DateField) {
    const input = event.target as HTMLInputElement;
    if (!isStart) {
      this.showTabSuggestion = false;
    }

    const value = sanitizeDateField(input.value, field, this.maxDaysFor(isStart));
    this.setFieldValue(isStart, field, value);
    input.value = value;

    // Auto-advance
    if (value.length === fieldMaxLength(field)) {
      this.focusNext(isStart, field);
      this.tryParseDate(isStart);
    }
  }

  onKeyDown(event: KeyboardEvent, isStart: boolean, field: DateField) {
    const input = event.target as HTMLInputElement;

    // Accept the tab suggestion: fill the end time from the start time + default duration
    if (this.showTabSuggestion && !isStart && field === "hour" && event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      this.acceptTabSuggestion();
      return;
    }

    // Any other interaction in the end fields dismisses the suggestion
    if (!isStart) {
      this.showTabSuggestion = false;
    }

    if (event.key === "Backspace" && input.value === "") {
      this.focusPrevious(isStart, field, "end");
    } else if (event.key === "ArrowLeft" && input.selectionStart === 0) {
      event.preventDefault();
      this.focusPrevious(isStart, field, "end");
    } else if (event.key === "ArrowRight" && input.selectionEnd === input.value.length) {
      event.preventDefault();
      this.focusNext(isStart, field, "start");
    }
  }

  onBlur(isStart: boolean) {
    if (!isStart && !this.tabShortcutPressed) {
      this.showTabSuggestion = false;
    }
    if (isStart) {
      this.startMonthStr = padMonth(this.startMonthStr);
      this.startDayStr = padAndValidateDay(this.startDayStr, this.maxDaysFor(true));
      if (this.hasTime && this.isSingleDate) {
        this.startHourStr = padTimePart(this.startHourStr);
        this.startMinuteStr = padTimePart(this.startMinuteStr);
      }
    } else {
      if (this.mode === "datetime-period") {
        this.endHourStr = padTimePart(this.endHourStr);
        this.endMinuteStr = padTimePart(this.endMinuteStr);
      } else {
        this.endMonthStr = padMonth(this.endMonthStr);
        this.endDayStr = padAndValidateDay(this.endDayStr, this.maxDaysFor(false));
      }
    }
    this.tryParseDate(isStart);
  }

  private updateLocale() {
    const lang = this.translateService.currentLang || "en";
    this.isFrench = lang === "fr" || lang === "ru"; // Assuming ru uses DD/MM as well
    moment.locale(lang);

    this.weekDays = [];
    const startOfWeek = this.clockService.moment().startOf("week");
    for (let i = 0; i < 7; i++) {
      this.weekDays.push(startOfWeek.clone().add(i, "days").format("ddd").toUpperCase());
    }

    this.generateCalendar();
  }

  private generateCalendar() {
    this.calendar = buildCalendarWeeks(this.viewDate, this.clockService.moment());
  }

  private setStartDate(date: moment.Moment | null) {
    this.startDate = date ? date.toDate() : null;
    this.updateInputStrings(true, date);
    this.startDateChange.emit(this.startDate);
  }

  private setSingleDate(date: moment.Moment | null) {
    this.date = date ? date.toDate() : null;
    this.updateInputStrings(true, date);
    this.dateChange.emit(this.date);
  }

  private setEndDate(date: moment.Moment | null) {
    this.endDate = date ? date.toDate() : null;
    this.updateInputStrings(false, date);
    this.endDateChange.emit(this.endDate);
  }

  private updateInputStrings(isStart: boolean, date: moment.Moment | null) {
    const withTime = this.hasTime && this.isSingleDate;
    const fields = formatTypedFields(date, withTime);

    if (isStart) {
      this.startDayStr = fields.day;
      this.startMonthStr = fields.month;
      this.startYearStr = fields.year;
      /* Sans date, les champs d'heure sont vidés aussi (quelle que soit la présence d'une heure). */
      if (withTime || !date) {
        this.startHourStr = fields.hour;
        this.startMinuteStr = fields.minute;
      }
      return;
    }

    this.endDayStr = fields.day;
    this.endMonthStr = fields.month;
    this.endYearStr = fields.year;
  }

  /** État de sélection courant, lu par les prédicats de plage du template. */
  private get rangeState(): RangeState {
    return {
      isSingleDate: this.isSingleDate,
      date: this.date,
      startDate: this.startDate,
      endDate: this.endDate,
      hoverDate: this.hoverDate,
    };
  }

  private getElementFor(isStart: boolean, field: "day" | "month" | "year" | "hour" | "minute"): ElementRef | undefined {
    if (isStart) {
      if (field === "day") return this.startDayEl;
      if (field === "month") return this.startMonthEl;
      if (field === "year") return this.startYearEl;
      if (field === "hour") return this.startHourEl;
      if (field === "minute") return this.startMinuteEl;
    } else {
      if (this.mode === "datetime-period") {
        if (field === "hour") return this.endHourEl;
        if (field === "minute") return this.endMinuteEl;
      }
      if (field === "day") return this.endDayEl;
      if (field === "month") return this.endMonthEl;
      if (field === "year") return this.endYearEl;
    }
    return undefined;
  }

  private get orderedElements(): ElementRef[] {
    const startEls = this.isFrench
      ? [this.startDayEl, this.startMonthEl, this.startYearEl]
      : [this.startMonthEl, this.startDayEl, this.startYearEl];

    if (this.hasTime && this.isSingleDate) {
      startEls.push(this.startHourEl, this.startMinuteEl);
    }

    if (this.isSingleDate) {
      if (this.mode === "datetime-period") {
        startEls.push(this.endHourEl, this.endMinuteEl);
      }
      return startEls;
    }

    const endEls = this.isFrench ? [this.endDayEl, this.endMonthEl, this.endYearEl] : [this.endMonthEl, this.endDayEl, this.endYearEl];

    return [...startEls, ...endEls];
  }

  private moveFocus(
    isStart: boolean,
    field: "day" | "month" | "year" | "hour" | "minute",
    direction: 1 | -1,
    cursorPosition?: "start" | "end",
  ) {
    const currentEl = this.getElementFor(isStart, field);
    if (!currentEl) return;

    const elements = this.orderedElements;
    const currentIndex = elements.indexOf(currentEl);
    if (currentIndex === -1) return;

    const nextEl = elements[currentIndex + direction];
    if (nextEl) {
      const el = nextEl.nativeElement as HTMLInputElement;
      el.focus();
      if (cursorPosition) {
        setTimeout(() => {
          const pos = cursorPosition === "start" ? 0 : el.value.length;
          el.setSelectionRange(pos, pos);
        });
      }
    }
  }

  private focusNext(isStart: boolean, field: "day" | "month" | "year" | "hour" | "minute", cursorPosition?: "start" | "end") {
    this.moveFocus(isStart, field, 1, cursorPosition);
  }

  private focusPrevious(isStart: boolean, field: "day" | "month" | "year" | "hour" | "minute", cursorPosition?: "start" | "end") {
    this.moveFocus(isStart, field, -1, cursorPosition);
  }

  private maxDaysFor(isStart: boolean): number {
    return daysInMonth(isStart ? this.startMonthStr : this.endMonthStr, isStart ? this.startYearStr : this.endYearStr);
  }

  private tryParseDate(isStart: boolean) {
    const isSingle = this.isSingleDate;
    const parsed = parseTypedDate({
      day: isSingle || isStart ? this.startDayStr : this.endDayStr,
      month: isSingle || isStart ? this.startMonthStr : this.endMonthStr,
      year: isSingle || isStart ? this.startYearStr : this.endYearStr,
      hour: this.hasTime && isSingle ? this.startHourStr : null,
      minute: this.hasTime && isSingle ? this.startMinuteStr : null,
    });

    if (parsed.kind === "empty") {
      if (isSingle) this.setSingleDate(null);
      else if (isStart) this.setStartDate(null);
      else this.setEndDate(null);
      return;
    }
    if (parsed.kind === "pending") {
      return;
    }

    this.applyParsedDate(parsed.date, isStart);
  }

  /** Applies a parsed date, keeping the range coherent (clear the end, or swap the bounds). */
  private applyParsedDate(parsed: moment.Moment, isStart: boolean): void {
    if (this.isSingleDate) {
      if (this.mode === "datetime-period") {
        this.applyPeriodTimes(parsed);
      } else {
        this.setSingleDate(parsed);
      }
      return;
    }

    if (isStart) {
      this.setStartDate(parsed);
      // If start becomes > end, clear end
      if (this.endDate && parsed.isAfter(moment(this.endDate))) {
        this.setEndDate(null);
      }
      return;
    }

    this.setEndDate(parsed);
    // If end becomes < start, swap them
    if (this.startDate && parsed.isBefore(moment(this.startDate))) {
      this.setEndDate(moment(this.startDate));
      this.setStartDate(parsed);
    }
  }

  /**
   * Applies the datetime-period time fields after a date parse.
   * Keeps the period within a single day by swapping the times when the end is before the start,
   * mirroring the clock picker and the date-range swap behavior.
   */
  private applyPeriodTimes(parsedDate: moment.Moment): void {
    if (
      this.startHourStr.length !== 2 ||
      this.startMinuteStr.length !== 2 ||
      this.endHourStr.length !== 2 ||
      this.endMinuteStr.length !== 2
    ) {
      this.setSingleDate(parsedDate);
      return;
    }

    const period = orderPeriodTimes(`${this.startHourStr}:${this.startMinuteStr}`, `${this.endHourStr}:${this.endMinuteStr}`);

    const startDate = parsedDate
      .clone()
      .hour(parseInt(period.start.slice(0, 2), 10))
      .minute(parseInt(period.start.slice(3, 5), 10));
    this.setSingleDate(startDate);
    this.startHourStr = period.start.slice(0, 2);
    this.startMinuteStr = period.start.slice(3, 5);
    this.endHourStr = period.end.slice(0, 2);
    this.endMinuteStr = period.end.slice(3, 5);
    this.startTime = period.start;
    this.endTime = period.end;
    this.periodChange.emit(period);
  }

  private acceptTabSuggestion(): void {
    const end = this.suggestedEndTime;
    if (!end) {
      this.showTabSuggestion = false;
      return;
    }

    // Mirror the shared shortcut press animation (see triggerShortcut in the graph components)
    this.tabShortcutPressed = true;
    setTimeout(() => {
      this.tabShortcutPressed = false;
      this.showTabSuggestion = false;
      this.cdr.markForCheck();
    }, 150);

    this.endHourStr = end.slice(0, 2);
    this.endMinuteStr = end.slice(3, 5);

    if (this.date) {
      this.applyPeriodTimes(moment(this.date));
    } else {
      this.startTime = `${this.startHourStr}:${this.startMinuteStr}`;
      this.endTime = end;
      this.periodChange.emit({ start: this.startTime, end: this.endTime });
    }
    this.focusNext(false, "hour");
  }
}
