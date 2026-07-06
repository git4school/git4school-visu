import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';

@Component({
  selector: 'app-time-picker',
  templateUrl: './time-picker.component.html',
  styleUrls: ['./time-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimePickerComponent implements OnInit, OnChanges {
  @Input() mode: 'single' | 'period' = 'single';
  
  // Format: 'HH:mm'
  @Input() time: string;
  @Output() timeChange = new EventEmitter<string>();

  @Input() startTime: string;
  @Input() endTime: string;
  @Output() periodChange = new EventEmitter<{ start: string; end: string }>();

  @Input() defaultDuration = 120; // Default session duration in minutes

  @ViewChild('touchArea', { static: true }) touchArea: ElementRef<HTMLElement>;

  hoverTime: string | null = null;
  isDragging = false;
  dragMode: 'new' | 'start' | 'end' | 'single' | null = null;
  hasMovedSinceMousedown = false;
  dragOriginTime: string | null = null;

  ticks: number[] = Array.from({ length: 24 }, (_, i) => i);
  
  get isAmPm(): boolean {
    return this.translate.currentLang === 'en';
  }

  get formattedHoverTime(): string {
    return this.hoverTime ? this.formatTimeDisplay(this.hoverTime) : '';
  }

  get centerMainDisplay(): string {
    if (this.hoverTime) {
      if (this.mode === 'period' && this.isDragging && this.dragMode === 'new') {
        const start = this.startTime || '00:00';
        return `${this.formatTimeDisplay(start)} -\n${this.formatTimeDisplay(this.hoverTime)}`;
      }
      return this.formatTimeDisplay(this.hoverTime);
    }
    
    if (this.mode === 'single') {
      return this.time ? this.formatTimeDisplay(this.time) : '--:--';
    } else {
      if (this.startTime && this.endTime) {
        return `${this.formatTimeDisplay(this.startTime)} -\n${this.formatTimeDisplay(this.endTime)}`;
      }
      return '--:-- -\n--:--';
    }
  }

  get durationDisplay(): string {
    if (this.mode !== 'period') return '';
    let startStr = this.startTime;
    let endStr = this.endTime;

    if (this.hoverTime && this.isDragging && this.dragMode === 'new') {
       endStr = this.hoverTime;
    }

    if (!startStr || !endStr) return '';

    const startMins = this.timeToMinutes(startStr);
    const endMins = this.timeToMinutes(endStr);
    let diff = endMins - startMins;
    if (diff < 0) diff += 24 * 60; // handle wrap around midnight

    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    if (hours > 0) {
      return `${hours}h${mins > 0 ? mins : ''}`;
    }
    return `${mins}m`;
  }

  constructor(private translate: TranslateService, private cd: ChangeDetectorRef) {}

  ngOnInit(): void {
    if (!this.time && this.mode === 'single') {
      this.time = '12:00';
    }
    if (this.mode === 'period' && (!this.startTime || !this.endTime)) {
      this.startTime = '12:00';
      this.endTime = this.minutesToTime(this.timeToMinutes('12:00') + this.defaultDuration);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // React to external changes if necessary
  }

  getTickLabel(tick: number): string {
    if (this.isAmPm) {
      if (tick === 0) return '12'; // 12 AM
      if (tick === 12) return '12'; // 12 PM
      return (tick % 12).toString();
    }
    return tick.toString();
  }

  formatTimeDisplay(timeStr: string): string {
    if (!timeStr) return '';
    if (!this.isAmPm) return timeStr;
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  // Parses 'HH:mm' to minutes from 00:00
  timeToMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  // Formats minutes from 00:00 to 'HH:mm'
  minutesToTime(minutes: number): string {
    minutes = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  getAngleFromTime(timeStr: string): number {
    const mins = this.timeToMinutes(timeStr);
    return (mins / (24 * 60)) * 360;
  }

  getPeriodGradient(): string {
    if (this.mode !== 'period' || !this.startTime || !this.endTime) return 'none';
    const startMins = this.timeToMinutes(this.startTime);
    const endMins = this.timeToMinutes(this.endTime);
    
    let startAngle = (startMins / (24 * 60)) * 360;
    let endAngle = (endMins / (24 * 60)) * 360;

    const color = 'var(--color-primary)'; 
    const trans = 'transparent';

    if (endAngle >= startAngle) {
      return `conic-gradient(from 0deg, ${trans} 0deg ${startAngle}deg, ${color} ${startAngle}deg ${endAngle}deg, ${trans} ${endAngle}deg 360deg)`;
    } else {
      return `conic-gradient(from 0deg, ${color} ${endAngle}deg, ${trans} ${endAngle}deg ${startAngle}deg, ${color} ${startAngle}deg)`;
    }
  }

  onMouseLeave() {
    if (!this.isDragging) {
      this.hoverTime = null;
      this.cd.markForCheck();
    }
  }

  onMouseMove(event: MouseEvent | TouchEvent) {
    const rect = this.touchArea.nativeElement.getBoundingClientRect();
    const clientX = event instanceof MouseEvent ? event.clientX : (event as TouchEvent).touches[0].clientX;
    const clientY = event instanceof MouseEvent ? event.clientY : (event as TouchEvent).touches[0].clientY;
    
    const x = clientX - rect.left - rect.width / 2;
    const y = clientY - rect.top - rect.height / 2;
    
    // Ignore if inside inner circle (130 - 24 = 106px radius) unless dragging
    if (!this.isDragging) {
      const distance = Math.sqrt(x*x + y*y);
      if (distance < 106) {
        if (this.hoverTime !== null) {
          this.hoverTime = null;
          this.cd.markForCheck();
        }
        return;
      }
    }
    
    let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    
    // Convert angle to minutes
    const totalMinutes = (angle / 360) * 24 * 60;
    // Snap to 5 minutes
    const snappedMinutes = Math.round(totalMinutes / 5) * 5;
    const newTime = this.minutesToTime(snappedMinutes);

    this.hoverTime = newTime;

    if (this.isDragging) {
      this.hasMovedSinceMousedown = true;
      if (this.mode === 'single') {
        this.time = newTime;
        this.timeChange.emit(this.time);
      } else {
        if (this.dragMode === 'new' && this.dragOriginTime) {
          const minsOrigin = this.timeToMinutes(this.dragOriginTime);
          const minsNew = this.timeToMinutes(newTime);
          if (minsNew < minsOrigin) {
            this.startTime = newTime;
            this.endTime = this.dragOriginTime;
          } else {
            this.startTime = this.dragOriginTime;
            this.endTime = newTime;
          }
        } else if (this.dragMode === 'start') {
          const minsNew = this.timeToMinutes(newTime);
          const minsEnd = this.timeToMinutes(this.endTime);
          if (minsNew > minsEnd) {
            this.startTime = this.endTime;
            this.endTime = newTime;
            this.dragMode = 'end';
          } else {
            this.startTime = newTime;
          }
        } else if (this.dragMode === 'end') {
          const minsNew = this.timeToMinutes(newTime);
          const minsStart = this.timeToMinutes(this.startTime);
          if (minsNew < minsStart) {
            this.endTime = this.startTime;
            this.startTime = newTime;
            this.dragMode = 'start';
          } else {
            this.endTime = newTime;
          }
        }
        this.periodChange.emit({ start: this.startTime, end: this.endTime });
      }
    }
    
    this.cd.markForCheck();
  }

  @HostListener('document:mousemove', ['$event'])
  @HostListener('document:touchmove', ['$event'])
  onDocumentMouseMove(event: MouseEvent | TouchEvent) {
    if (this.isDragging) {
      this.onMouseMove(event);
    }
  }

  onMouseDown(event: MouseEvent | TouchEvent, type: 'start' | 'end' | 'face' = 'face') {
    if (type === 'face') {
      const rect = this.touchArea.nativeElement.getBoundingClientRect();
      const clientX = event instanceof MouseEvent ? event.clientX : (event as TouchEvent).touches[0].clientX;
      const clientY = event instanceof MouseEvent ? event.clientY : (event as TouchEvent).touches[0].clientY;
      const x = clientX - rect.left - rect.width / 2;
      const y = clientY - rect.top - rect.height / 2;
      const distance = Math.sqrt(x*x + y*y);
      if (distance < 106) return; // Do nothing if clicked inside inner circle
    }

    event.preventDefault(); // prevent text selection
    this.isDragging = true;
    this.hasMovedSinceMousedown = false;

    // Just to get the initial hover time exactly at click pos:
    this.onMouseMove(event);
    this.hasMovedSinceMousedown = false; // Reset it because onMouseMove sets it to true!

    if (this.mode === 'single') {
      this.dragMode = 'single';
      this.time = this.hoverTime;
      this.timeChange.emit(this.time);
    } else {
      if (type === 'start') {
        this.dragMode = 'start';
      } else if (type === 'end') {
        this.dragMode = 'end';
      } else {
        this.dragMode = 'new';
        this.dragOriginTime = this.hoverTime;
        this.startTime = this.hoverTime;
        this.endTime = this.hoverTime;
        // Don't set end time yet, wait for drag or mouse up
      }
    }
  }

  @HostListener('document:mouseup')
  @HostListener('document:touchend')
  onMouseUp() {
    if (this.isDragging) {
      if (this.mode === 'period' && this.dragMode === 'new' && !this.hasMovedSinceMousedown && this.dragOriginTime) {
        // Just a click on the face without dragging
        const originMins = this.timeToMinutes(this.dragOriginTime);
        const endMins = originMins + this.defaultDuration;
        if (endMins >= 24 * 60) {
           this.startTime = this.minutesToTime(originMins);
           this.endTime = '23:55';
        } else {
           this.startTime = this.dragOriginTime;
           this.endTime = this.minutesToTime(endMins);
        }
        this.periodChange.emit({ start: this.startTime, end: this.endTime });
      }
      this.isDragging = false;
      this.dragMode = null;
      this.dragOriginTime = null;
      this.cd.markForCheck();
    }
  }

  onCenterInputBlur(event: any, type: 'single' | 'start' | 'end') {
    const val = event.target.innerText.trim();
    if (this.mode === 'period') {
      const parts = val.split(/[-\n]+/).map((p: string) => p.trim());
      if (parts.length >= 2 && this.isValidTime(parts[0]) && this.isValidTime(parts[1])) {
        this.startTime = this.parseInputTime(parts[0]);
        this.endTime = this.parseInputTime(parts[1]);
        this.enforcePeriodLogic();
        this.periodChange.emit({ start: this.startTime, end: this.endTime });
      }
    } else {
      if (this.isValidTime(val)) {
        this.time = this.parseInputTime(val);
        this.timeChange.emit(this.time);
      }
    }

    // Re-render to format nicely. Using a timeout to ensure it happens after value change.
    setTimeout(() => {
      event.target.innerText = this.centerMainDisplay;
      this.cd.markForCheck();
    });
  }

  private enforcePeriodLogic() {
    if (this.mode === 'period') {
      const s = this.timeToMinutes(this.startTime);
      const e = this.timeToMinutes(this.endTime);
      if (s > e) {
        [this.startTime, this.endTime] = [this.endTime, this.startTime];
      }
    }
  }

  onCenterInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      (event.target as HTMLElement).blur();
    }
  }

  isValidTime(timeStr: string): boolean {
    if (this.isAmPm) {
      return /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM|am|pm)$/.test(timeStr);
    }
    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr);
  }

  parseInputTime(timeStr: string): string {
    if (!this.isAmPm) {
      const [h, m] = timeStr.split(':').map(Number);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    } else {
      const match = timeStr.match(/^(0?[1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM|am|pm)$/);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      }
      return '12:00';
    }
  }
}
