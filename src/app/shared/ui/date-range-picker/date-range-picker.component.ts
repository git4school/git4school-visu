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
export class DateRangePickerComponent implements OnInit, OnDestroy {
  @Input() startDate: Date | null = null;
  @Input() endDate: Date | null = null;

  @Output() startDateChange = new EventEmitter<Date | null>();
  @Output() endDateChange = new EventEmitter<Date | null>();

  @ViewChild("startDay", { static: false }) startDayEl: ElementRef;
  @ViewChild("startMonth", { static: false }) startMonthEl: ElementRef;
  @ViewChild("startYear", { static: false }) startYearEl: ElementRef;
  @ViewChild("endDay", { static: false }) endDayEl: ElementRef;
  @ViewChild("endMonth", { static: false }) endMonthEl: ElementRef;
  @ViewChild("endYear", { static: false }) endYearEl: ElementRef;

  isOpen = false;
  dropUp = false;
  viewDate: moment.Moment = moment();
  hoverDate: moment.Moment | null = null;

  calendar: CalendarDay[][] = [];
  weekDays: string[] = [];

  // Used for typing dates in the input
  startDayStr = "";
  startMonthStr = "";
  startYearStr = "";
  endDayStr = "";
  endMonthStr = "";
  endYearStr = "";

  isFrench = false;

  private langSubscription: Subscription;

  constructor(
    private elementRef: ElementRef,
    private translateService: TranslateService
  ) {}

  ngOnInit(): void {
    this.updateLocale();
    this.langSubscription = this.translateService.onLangChange.subscribe(() => {
      this.updateLocale();
    });

    if (this.startDate) {
      this.viewDate = moment(this.startDate);
      this.updateInputStrings(true, moment(this.startDate));
    } else if (this.endDate) {
      this.viewDate = moment(this.endDate);
    }

    if (this.endDate) {
      this.updateInputStrings(false, moment(this.endDate));
    }

    this.generateCalendar();
  }

  ngOnDestroy(): void {
    if (this.langSubscription) {
      this.langSubscription.unsubscribe();
    }
  }

  get currentMonthName(): string {
    return this.viewDate.format("MMMM YYYY");
  }

  togglePopup() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      if (this.startDate) {
        this.viewDate = moment(this.startDate);
      }
      this.generateCalendar();

      // Check available space
      setTimeout(() => {
        const rect = this.elementRef.nativeElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;

        // Popup is approx 380px tall. Drop up if space below is insufficient AND space above is larger.
        this.dropUp = spaceBelow < 380 && spaceAbove > spaceBelow;
      });
    } else {
      this.dropUp = false;
    }
  }

  closePopup() {
    this.isOpen = false;
  }

  @HostListener("document:click", ["$event"])
  onClickOutside(event: Event) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
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

    if (!this.startDate && !this.endDate) {
      this.setStartDate(clickedDate);
    } else if (this.startDate && !this.endDate) {
      if (clickedDate.isBefore(this.startDate)) {
        this.setEndDate(moment(this.startDate));
        this.setStartDate(clickedDate);
      } else {
        this.setEndDate(clickedDate);
      }
      this.closePopup();
    } else if (!this.startDate && this.endDate) {
      if (clickedDate.isAfter(this.endDate)) {
        this.setStartDate(moment(this.endDate));
        this.setEndDate(clickedDate);
      } else {
        this.setStartDate(clickedDate);
      }
      this.closePopup();
    } else {
      // Both exist. Reset and start over
      this.setStartDate(clickedDate);
      this.setEndDate(null);
    }
  }

  onDateHover(day: CalendarDay) {
    this.hoverDate = day.date;
  }

  onDateLeave() {
    this.hoverDate = null;
  }

  isStartDate(date: moment.Moment): boolean {
    return !!this.startDate && date.isSame(moment(this.startDate), "day");
  }

  isEndDate(date: moment.Moment): boolean {
    return !!this.endDate && date.isSame(moment(this.endDate), "day");
  }

  isInRange(date: moment.Moment): boolean {
    if (this.startDate && this.endDate) {
      return (
        date.isAfter(moment(this.startDate), "day") &&
        date.isBefore(moment(this.endDate), "day")
      );
    }

    if (this.startDate && !this.endDate && this.hoverDate) {
      if (this.hoverDate.isAfter(moment(this.startDate), "day")) {
        return (
          date.isAfter(moment(this.startDate), "day") &&
          date.isSameOrBefore(this.hoverDate, "day")
        );
      }
    }

    if (!this.startDate && this.endDate && this.hoverDate) {
      if (this.hoverDate.isBefore(moment(this.endDate), "day")) {
        return (
          date.isBefore(moment(this.endDate), "day") &&
          date.isSameOrAfter(this.hoverDate, "day")
        );
      }
    }

    return false;
  }

  setToday() {
    const today = moment().startOf("day");
    this.setStartDate(today);
    this.setEndDate(today);
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

  onInputType(event: Event, isStart: boolean, field: "day" | "month" | "year") {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, ""); // Keep only digits

    const maxLength = field === "year" ? 4 : 2;
    if (value.length > maxLength) {
      value = value.substring(0, maxLength);
    }

    // Update local state
    if (isStart) {
      if (field === "day") this.startDayStr = value;
      if (field === "month") this.startMonthStr = value;
      if (field === "year") this.startYearStr = value;
    } else {
      if (field === "day") this.endDayStr = value;
      if (field === "month") this.endMonthStr = value;
      if (field === "year") this.endYearStr = value;
    }

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
    field: "day" | "month" | "year"
  ) {
    const input = event.target as HTMLInputElement;
    if (event.key === "Backspace" && input.value === "") {
      this.focusPrevious(isStart, field);
    }
  }

  onBlur(isStart: boolean) {
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
      } else {
        this.startDayStr = "";
        this.startMonthStr = "";
        this.startYearStr = "";
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

  private focusNext(isStart: boolean, field: "day" | "month" | "year") {
    let nextEl: ElementRef | undefined;
    if (isStart) {
      if (this.isFrench) {
        // DD / MM / YYYY
        if (field === "day") nextEl = this.startMonthEl;
        if (field === "month") nextEl = this.startYearEl;
        if (field === "year")
          nextEl = this.isFrench ? this.endDayEl : this.endMonthEl;
      } else {
        // MM / DD / YYYY
        if (field === "month") nextEl = this.startDayEl;
        if (field === "day") nextEl = this.startYearEl;
        if (field === "year")
          nextEl = this.isFrench ? this.endDayEl : this.endMonthEl;
      }
    } else {
      if (this.isFrench) {
        if (field === "day") nextEl = this.endMonthEl;
        if (field === "month") nextEl = this.endYearEl;
      } else {
        if (field === "month") nextEl = this.endDayEl;
        if (field === "day") nextEl = this.endYearEl;
      }
    }

    if (nextEl) {
      nextEl.nativeElement.focus();
    }
  }

  private focusPrevious(isStart: boolean, field: "day" | "month" | "year") {
    let prevEl: ElementRef | undefined;
    if (isStart) {
      if (this.isFrench) {
        if (field === "month") prevEl = this.startDayEl;
        if (field === "year") prevEl = this.startMonthEl;
      } else {
        if (field === "day") prevEl = this.startMonthEl;
        if (field === "year") prevEl = this.startDayEl;
      }
    } else {
      if (this.isFrench) {
        if (field === "day") prevEl = this.startYearEl;
        if (field === "month") prevEl = this.endDayEl;
        if (field === "year") prevEl = this.endMonthEl;
      } else {
        if (field === "month") prevEl = this.startYearEl;
        if (field === "day") prevEl = this.endMonthEl;
        if (field === "year") prevEl = this.endDayEl;
      }
    }

    if (prevEl) {
      prevEl.nativeElement.focus();
    }
  }

  private tryParseDate(isStart: boolean) {
    const day = isStart ? this.startDayStr : this.endDayStr;
    const month = isStart ? this.startMonthStr : this.endMonthStr;
    const year = isStart ? this.startYearStr : this.endYearStr;

    if (day.length === 2 && month.length === 2 && year.length === 4) {
      const parsed = moment(`${year}-${month}-${day}`, "YYYY-MM-DD", true);
      if (parsed.isValid()) {
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
    } else if (day.length === 0 && month.length === 0 && year.length === 0) {
      if (isStart) {
        this.setStartDate(null);
      } else {
        this.setEndDate(null);
      }
    }
  }
}
