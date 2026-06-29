import { Component, OnInit } from "@angular/core";
import { Toast, ToastService } from "@services/toast.service";

@Component({
  selector: "app-toasts",
  templateUrl: "./toasts.component.html",
  styleUrls: ["./toasts.component.scss"],
})
export class ToastsComponent implements OnInit {
  toasts: Toast[] = [];

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.toastService.toasts$.subscribe((toasts) => {
      this.toasts = toasts;
    });
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
    // Resume auto-close with a 4s timeout
    toast.timeoutId = setTimeout(() => this.remove(toast.id), 4000);
  }
}
