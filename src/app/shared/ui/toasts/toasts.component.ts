import { Component, OnInit, ChangeDetectorRef, ViewChildren, QueryList, AfterViewChecked, ElementRef } from "@angular/core";
import { Toast, ToastService } from "@services/toast.service";
import { trigger, transition, style, animate } from "@angular/animations";

@Component({
  selector: "app-toasts",
  templateUrl: "./toasts.component.html",
  styleUrls: ["./toasts.component.scss"],
  animations: [
    trigger('toastEntry', [
      transition(':enter', [
        style({ transform: 'translateY(100%)', opacity: 0 }),
        animate('0.4s cubic-bezier(0.2, 1, 0.2, 1)', style({ transform: 'translateY(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('0.3s ease-in', style({ transform: 'scale(0.9)', opacity: 0 }))
      ])
    ])
  ]
})
export class ToastsComponent implements OnInit, AfterViewChecked {
  toasts: Toast[] = [];
  isHovered: boolean = false;
  hoverTimeout: any;
  toastHeights: number[] = [];

  @ViewChildren('toastElement') toastElements!: QueryList<ElementRef>;

  constructor(private toastService: ToastService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.toastService.toasts$.subscribe((toasts) => {
      this.toasts = toasts;
    });
  }

  ngAfterViewChecked(): void {
    this.updateHeights();
  }

  updateHeights(): void {
    if (!this.toastElements) return;
    const elements = this.toastElements.toArray();
    let changed = false;
    
    if (this.toastHeights.length !== elements.length) {
      this.toastHeights = new Array(elements.length).fill(0);
      changed = true;
    }

    elements.forEach((el, i) => {
      const h = el.nativeElement.offsetHeight;
      if (this.toastHeights[i] !== h) {
        this.toastHeights[i] = h;
        changed = true;
      }
    });

    if (changed) {
      setTimeout(() => this.cdr.detectChanges());
    }
  }

  getOffset(index: number): number {
    let offset = 0;
    const gap = 16; // 1rem
    for (let i = index + 1; i < this.toasts.length; i++) {
      offset += (this.toastHeights[i] || 0) + gap;
    }
    return offset;
  }

  onMouseEnter() {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    this.isHovered = true;
  }

  onMouseLeave() {
    this.hoverTimeout = setTimeout(() => {
      this.isHovered = false;
    }, 200);
  }

  remove(id: number) {
    this.toastService.remove(id);
  }

  pauseTimer(toast: Toast) {
    if (toast.timeoutId) {
      clearTimeout(toast.timeoutId);
    }
  }

  resumeTimer(toast: Toast) {
    toast.timeoutId = setTimeout(() => this.remove(toast.id), 4000);
  }

  trackById(index: number, toast: Toast): number {
    return toast.id;
  }
}
