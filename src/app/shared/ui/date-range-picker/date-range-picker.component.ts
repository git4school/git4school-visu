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
  SimpleChanges
} from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import * as moment from "moment";
import { Subscription } from "rxjs";

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
})
export class DateRangePickerComponent implements OnInit, OnDestroy, OnChanges {
  @Input() startDate: Date | null = null;
  @Input() endDate: Date | null = null;
  @Input() mode: 'date-range' | 'date' | 'datetime' | 'datetime-period' = 'date-range';
  @Input() startTime: string = '12:00';
  @Input() endTime: string = '14:00';
  @Input() defaultDuration = 120;
  @Output() periodChange = new EventEmitter<{ start: string; end: string }>();

  get isSingleDate(): boolean { return this.mode !== 'date-range'; }
  get hasTime(): boolean { return this.mode === 'datetime' || this.mode === 'datetime-period'; }
  @Input() date: Date | null = null;
  
  @Input() startLabel = 'METADATA.START-DATE';
  @Input() endLabel = 'METADATA.END-DATE';
  @Input() singleLabel = 'DATE';

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

  isOpen = false;
  dropUp = false;
  alignRight = false;
  viewDate: moment.Moment = moment();
  hoverDate: moment.Moment | null = null;

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

  constructor(
    private elementRef: ElementRef,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['date'] && this.isSingleDate) {
      if (this.date) {
        this.viewDate = moment(this.date);
        this.updateInputStrings(true, moment(this.date));
      } else {
        this.updateInputStrings(true, null);
      }
    }
    
    if (this.mode === 'datetime-period') {
      if (changes['startTime'] && this.startTime) {
        this.startHourStr = this.startTime.split(':')[0];
        this.startMinuteStr = this.startTime.split(':')[1];
      }
      if (changes['endTime'] && this.endTime) {
        this.endHourStr = this.endTime.split(':')[0];
        this.endMinuteStr = this.endTime.split(':')[1];
      }
    }
    
    if (!this.isSingleDate) {
      if (changes['startDate']) {
        if (this.startDate) {
          this.viewDate = moment(this.startDate);
          this.updateInputStrings(true, moment(this.startDate));
        } else {
          this.updateInputStrings(true, null);
        }
      }
      if (changes['endDate']) {
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

    if (this.mode === 'datetime-period') {
      if (this.startTime) {
        this.startHourStr = this.startTime.split(':')[0];
        this.startMinuteStr = this.startTime.split(':')[1];
      }
      if (this.endTime) {
        this.endHourStr = this.endTime.split(':')[0];
        this.endMinuteStr = this.endTime.split(':')[1];
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

    // Use capture phase to bypass stopPropagation() called by modals
    document.addEventListener("click", this.onDocumentClick, { capture: true });
  }

  ngOnDestroy(): void {
    if (this.langSubscription) {
      this.langSubscription.unsubscribe();
    }
    document.removeEventListener("click", this.onDocumentClick, { capture: true });
  }

  get currentMonthName(): string {
    return this.viewDate.format("MMMM YYYY");
  }

  togglePopup() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.initViewDate();
      this.generateCalendar();
      this.updatePopupDirection();
    } else {
      this.dropUp = false;
      this.alignRight = false;
    }
    this.cdr.markForCheck();
  }

  private initViewDate(): void {
    if (this.mode === 'datetime-period') {
      if (this.startTime) {
        this.startHourStr = this.startTime.split(':')[0];
        this.startMinuteStr = this.startTime.split(':')[1];
      }
      if (this.endTime) {
        this.endHourStr = this.endTime.split(':')[0];
        this.endMinuteStr = this.endTime.split(':')[1];
      }
    }
    
    if (this.isSingleDate && this.date) {
      this.viewDate = moment(this.date);
    } else if (!this.isSingleDate && this.startDate) {
      this.viewDate = moment(this.startDate);
    }
  }

  private updatePopupDirection(): void {
    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Popup is approx 380px tall. Drop up if space below is insufficient AND space above is larger.
    this.dropUp = spaceBelow < 380 && spaceAbove > spaceBelow;

    const spaceRight = window.innerWidth - rect.left;
    const estimatedWidth = (this.isSingleDate && this.hasTime) || this.mode === 'datetime-period' ? 650 : 350;
    this.alignRight = spaceRight < estimatedWidth;
  }

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
  }

  previousMonth() {
    this.viewDate = this.viewDate.clone().subtract(1, "months");
    this.generateCalendar();
  }

  onDateClick(day: CalendarDay) {
    const clickedDate = day.date.clone().startOf("day");

    if (this.isSingleDate) {
      if (this.hasTime) {
        if (this.date) {
          clickedDate.hour(moment(this.date).hour()).minute(moment(this.date).minute());
        } else {
          clickedDate.hour(12).minute(0);
        }
      }
      
      this.setSingleDate(clickedDate);
      if (!this.hasTime) {
        this.closePopup();
      }
      return;
    }

    if (!this.startDate && !this.endDate) {
      this.setStartDate(clickedDate);
      return;
    } 
    
    if (this.startDate && !this.endDate) {
      if (clickedDate.isBefore(this.startDate)) {
        this.setEndDate(moment(this.startDate));
        this.setStartDate(clickedDate);
      } else {
        this.setEndDate(clickedDate);
      }
      this.closePopup();
      return;
    } 
    
    if (!this.startDate && this.endDate) {
      if (clickedDate.isAfter(this.endDate)) {
        this.setStartDate(moment(this.endDate));
        this.setEndDate(clickedDate);
      } else {
        this.setStartDate(clickedDate);
      }
      this.closePopup();
      return;
    } 
    
    // Both exist. Reset and start over
    this.setStartDate(clickedDate);
    this.setEndDate(null);
  }

  onDateHover(day: CalendarDay) {
    this.hoverDate = day.date;
  }

  onDateLeave() {
    this.hoverDate = null;
  }

  onPeriodChange(period: { start: string, end: string }) {
    this.startTime = period.start;
    this.endTime = period.end;
    this.startHourStr = this.startTime.split(':')[0];
    this.startMinuteStr = this.startTime.split(':')[1];
    this.endHourStr = this.endTime.split(':')[0];
    this.endMinuteStr = this.endTime.split(':')[1];
    this.periodChange.emit(period);
  }

  onTimeChange(newTime: string) {
    if (!this.date) {
      // If no date is set, use today
      const today = moment().startOf('day');
      const [h, m] = newTime.split(':');
      today.hour(parseInt(h, 10)).minute(parseInt(m, 10));
      this.setSingleDate(today);
    } else {
      const updatedDate = moment(this.date);
      const [h, m] = newTime.split(':');
      updatedDate.hour(parseInt(h, 10)).minute(parseInt(m, 10));
      this.setSingleDate(updatedDate);
    }
  }

  get timeString(): string {
    if (!this.date) return '12:00';
    return moment(this.date).format('HH:mm');
  }

  isStartDate(date: moment.Moment): boolean {
    if (this.isSingleDate) {
      return !!this.date && date.isSame(moment(this.date), "day");
    }
    return !!this.startDate && date.isSame(moment(this.startDate), "day");
  }

  isEndDate(date: moment.Moment): boolean {
    return !!this.endDate && date.isSame(moment(this.endDate), "day");
  }

  isInRange(date: moment.Moment): boolean {
    if (this.isSingleDate) return false;

    const start = this.startDate ? moment(this.startDate) : null;
    const end = this.endDate ? moment(this.endDate) : null;

    if (start && end) {
      return date.isAfter(start, "day") && date.isBefore(end, "day");
    }

    if (start && !end && this.hoverDate) {
      if (this.hoverDate.isAfter(start, "day")) {
        return date.isAfter(start, "day") && date.isBefore(this.hoverDate, "day");
      } else if (this.hoverDate.isBefore(start, "day")) {
        return date.isBefore(start, "day") && date.isAfter(this.hoverDate, "day");
      }
    }

    return false;
  }

  isRangeRight(date: moment.Moment): boolean {
    if (this.isSingleDate || !this.startDate || !date.isSame(this.startDate, 'day')) return false;
    if (this.endDate && moment(this.endDate).isAfter(this.startDate, 'day')) return true;
    if (!this.endDate && this.hoverDate && this.hoverDate.isAfter(this.startDate, 'day')) return true;
    return false;
  }

  isRangeLeft(date: moment.Moment): boolean {
    if (this.isSingleDate || !this.startDate || !date.isSame(this.startDate, 'day')) return false;
    if (!this.endDate && this.hoverDate && this.hoverDate.isBefore(this.startDate, 'day')) return true;
    return false;
  }

  isHoverForwardEnd(date: moment.Moment): boolean {
    if (this.isSingleDate || this.endDate || !this.startDate || !this.hoverDate) return false;
    return date.isSame(this.hoverDate, 'day') && this.hoverDate.isAfter(this.startDate, 'day');
  }

  isHoverBackwardStart(date: moment.Moment): boolean {
    if (this.isSingleDate || this.endDate || !this.startDate || !this.hoverDate) return false;
    return date.isSame(this.hoverDate, 'day') && this.hoverDate.isBefore(this.startDate, 'day');
  }

  setToday() {
    const today = moment();
    if (!this.hasTime || !this.isSingleDate) {
      today.startOf("day");
    }
    
    if (this.isSingleDate) {
      this.setSingleDate(today);
      if (this.mode === 'datetime-period') {
        const endDate = today.clone().add(this.defaultDuration, 'minutes');
        this.startTime = today.format('HH:mm');
        this.endTime = endDate.format('HH:mm');
        this.startHourStr = today.format('HH');
        this.startMinuteStr = today.format('mm');
        this.endHourStr = endDate.format('HH');
        this.endMinuteStr = endDate.format('mm');
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
    const start = moment().startOf("week");
    const end = moment().endOf("week").startOf("day");
    this.setStartDate(start);
    this.setEndDate(end);
    this.viewDate = start.clone();
    this.generateCalendar();
    this.closePopup();
  }

  setThisMonth() {
    const start = moment().startOf("month");
    const end = moment().endOf("month").startOf("day");
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
    }
  }

  private padMonth(monthStr: string): string {
    return monthStr.length === 1 ? `0${monthStr}` : monthStr;
  }

  private getMaxDays(isStart: boolean): number {
    const monthStr = isStart ? this.startMonthStr : this.endMonthStr;
    const yearStr = isStart ? this.startYearStr : this.endYearStr;
    if (monthStr.length === 2 && yearStr.length >= 4) {
      const parsed = moment(`${yearStr}-${monthStr}-01`, "YYYY-MM-DD", true);
      if (parsed.isValid()) return parsed.daysInMonth();
    }
    return 31;
  }

  private padAndValidateDay(dayStr: string, maxDays: number): string {
    let dStr = dayStr;
    if (dStr.length === 1) dStr = `0${dStr}`;
    if (dStr.length === 2) {
      const d = parseInt(dStr, 10);
      if (d > maxDays) dStr = maxDays.toString();
    }
    return dStr;
  }

  onInputType(event: Event, isStart: boolean, field: "day" | "month" | "year" | "hour" | "minute") {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, ""); // Keep only digits

    const maxLength = field === "year" ? 4 : 2;
    if (value.length > maxLength) {
      value = value.substring(0, maxLength);
    }

    if (value.length > 0) {
      const num = parseInt(value, 10);
      if (field === "month") {
        if (num > 12) value = "12";
        if (value.length === 2 && num === 0) value = "01";
        // Auto-pad if first digit is > 1
        if (value.length === 1 && num > 1) value = `0${num}`;
      } else if (field === "day") {
        const maxDays = this.getMaxDays(isStart);
        if (num > maxDays) value = maxDays.toString();
        if (value.length === 2 && num === 0) value = "01";
        // Auto-pad if first digit is > 3
        if (value.length === 1 && num > 3) value = `0${num}`;
      } else if (field === "hour") {
        if (num > 23) value = "23";
        if (value.length === 1 && num > 2) value = `0${num}`;
      } else if (field === "minute") {
        if (num > 59) value = "59";
        if (value.length === 1 && num > 5) value = `0${num}`;
      }
    }

    this.setFieldValue(isStart, field, value);
    input.value = value;

    // Auto-advance
    if (value.length === maxLength) {
      this.focusNext(isStart, field);
      this.tryParseDate(isStart);
    }
  }

  onKeyDown(
    event: KeyboardEvent,
    isStart: boolean,
    field: "day" | "month" | "year" | "hour" | "minute"
  ) {
    const input = event.target as HTMLInputElement;
    if (event.key === "Backspace" && input.value === "") {
      this.focusPrevious(isStart, field, 'end');
    } else if (event.key === "ArrowLeft" && input.selectionStart === 0) {
      event.preventDefault();
      this.focusPrevious(isStart, field, 'end');
    } else if (event.key === "ArrowRight" && input.selectionEnd === input.value.length) {
      event.preventDefault();
      this.focusNext(isStart, field, 'start');
    }
  }

  onBlur(isStart: boolean) {
    if (isStart) {
      this.startMonthStr = this.padMonth(this.startMonthStr);
      this.startDayStr = this.padAndValidateDay(this.startDayStr, this.getMaxDays(true));
      if (this.hasTime && this.isSingleDate) {
        if (this.startHourStr && this.startHourStr.length === 1) this.startHourStr = `0${this.startHourStr}`;
        if (this.startMinuteStr && this.startMinuteStr.length === 1) this.startMinuteStr = `0${this.startMinuteStr}`;
      }
    } else {
      if (this.mode === 'datetime-period') {
        if (this.endHourStr && this.endHourStr.length === 1) this.endHourStr = `0${this.endHourStr}`;
        if (this.endMinuteStr && this.endMinuteStr.length === 1) this.endMinuteStr = `0${this.endMinuteStr}`;
      } else {
        this.endMonthStr = this.padMonth(this.endMonthStr);
        this.endDayStr = this.padAndValidateDay(this.endDayStr, this.getMaxDays(false));
      }
    }
    this.tryParseDate(isStart);
  }

  private updateLocale() {
    const lang = this.translateService.currentLang || "en";
    this.isFrench = lang === "fr" || lang === "ru"; // Assuming ru uses DD/MM as well
    moment.locale(lang);

    this.weekDays = [];
    const startOfWeek = moment().startOf("week");
    for (let i = 0; i < 7; i++) {
      this.weekDays.push(
        startOfWeek.clone().add(i, "days").format("ddd").toUpperCase()
      );
    }

    this.generateCalendar();
  }

  private generateCalendar() {
    this.calendar = [];
    const startOfMonth = this.viewDate.clone().startOf("month");
    const startOfCalendar = startOfMonth.clone().startOf("week");

    let current = startOfCalendar.clone();

    for (let week = 0; week < 6; week++) {
      const weekDays: CalendarDay[] = [];
      for (let day = 0; day < 7; day++) {
        weekDays.push({
          date: current.clone(),
          day: current.date(),
          isToday: current.isSame(moment(), "day"),
          isCurrentMonth: current.month() === this.viewDate.month(),
        });
        current.add(1, "days");
      }
      this.calendar.push(weekDays);
    }
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
    if (isStart) {
      if (date) {
        this.startDayStr = date.format("DD");
        this.startMonthStr = date.format("MM");
        this.startYearStr = date.format("YYYY");
        if (this.hasTime && this.isSingleDate) {
          this.startHourStr = date.format("HH");
          this.startMinuteStr = date.format("mm");
        }
      } else {
        this.startDayStr = "";
        this.startMonthStr = "";
        this.startYearStr = "";
        this.startHourStr = "";
        this.startMinuteStr = "";
      }
    } else {
      if (date) {
        this.endDayStr = date.format("DD");
        this.endMonthStr = date.format("MM");
        this.endYearStr = date.format("YYYY");
      } else {
        this.endDayStr = "";
        this.endMonthStr = "";
        this.endYearStr = "";
      }
    }
  }

  private getElementFor(isStart: boolean, field: "day" | "month" | "year" | "hour" | "minute"): ElementRef | undefined {
    if (isStart) {
      if (field === "day") return this.startDayEl;
      if (field === "month") return this.startMonthEl;
      if (field === "year") return this.startYearEl;
      if (field === "hour") return this.startHourEl;
      if (field === "minute") return this.startMinuteEl;
    } else {
      if (this.mode === 'datetime-period') {
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

    if (this.isSingleDate) return startEls;

    const endEls = this.isFrench 
      ? [this.endDayEl, this.endMonthEl, this.endYearEl] 
      : [this.endMonthEl, this.endDayEl, this.endYearEl];

    return [...startEls, ...endEls];
  }

  private moveFocus(isStart: boolean, field: "day" | "month" | "year" | "hour" | "minute", direction: 1 | -1, cursorPosition?: 'start' | 'end') {
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
          const pos = cursorPosition === 'start' ? 0 : el.value.length;
          el.setSelectionRange(pos, pos);
        });
      }
    }
  }

  private focusNext(isStart: boolean, field: "day" | "month" | "year" | "hour" | "minute", cursorPosition?: 'start' | 'end') {
    this.moveFocus(isStart, field, 1, cursorPosition);
  }

  private focusPrevious(isStart: boolean, field: "day" | "month" | "year" | "hour" | "minute", cursorPosition?: 'start' | 'end') {
    this.moveFocus(isStart, field, -1, cursorPosition);
  }

  private tryParseDate(isStart: boolean) {
    const day = this.isSingleDate ? this.startDayStr : (isStart ? this.startDayStr : this.endDayStr);
    const month = this.isSingleDate ? this.startMonthStr : (isStart ? this.startMonthStr : this.endMonthStr);
    const year = this.isSingleDate ? this.startYearStr : (isStart ? this.startYearStr : this.endYearStr);
    const hour = (isStart && this.hasTime && this.isSingleDate) ? this.startHourStr : null;
    const minute = (isStart && this.hasTime && this.isSingleDate) ? this.startMinuteStr : null;

    if (day.length === 0 && month.length === 0 && year.length === 0) {
      if (this.isSingleDate) this.setSingleDate(null);
      else if (isStart) this.setStartDate(null);
      else this.setEndDate(null);
      return;
    }

    if (day.length === 2 && month.length === 2 && year.length === 4) {
      let format = "YYYY-MM-DD";
      let dateString = `${year}-${month}-${day}`;
      
      if (hour !== null && minute !== null) {
        if (hour.length !== 2 || minute.length !== 2) return; // Wait for full time input
        format = "YYYY-MM-DD HH:mm";
        dateString = `${year}-${month}-${day} ${hour}:${minute}`;
      }

      const parsed = moment(dateString, format, true);
      if (!parsed.isValid()) return;

      if (this.isSingleDate) {
        this.setSingleDate(parsed);
        if (this.mode === 'datetime-period') {
           if (this.endHourStr.length === 2 && this.endMinuteStr.length === 2 &&
               this.startHourStr.length === 2 && this.startMinuteStr.length === 2) {
               this.startTime = `${this.startHourStr}:${this.startMinuteStr}`;
               this.endTime = `${this.endHourStr}:${this.endMinuteStr}`;
               this.periodChange.emit({ start: this.startTime, end: this.endTime });
           }
        }
        return;
      }

      if (isStart) {
        this.setStartDate(parsed);
        // If start becomes > end, clear end
        if (this.endDate && parsed.isAfter(moment(this.endDate))) {
          this.setEndDate(null);
        }
      } else {
        this.setEndDate(parsed);
        // If end becomes < start, swap them
        if (this.startDate && parsed.isBefore(moment(this.startDate))) {
          this.setEndDate(moment(this.startDate));
          this.setStartDate(parsed);
        }
      }
    }
  }
}
