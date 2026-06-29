import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

export type ToastType = "success" | "warning" | "error" | "copy";

export interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  timeoutId?: any;
}

@Injectable({
  providedIn: "root",
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  public toasts$ = this.toastsSubject.asObservable();
  private idCounter = 0;

  constructor() {}

  warning(titre: string, message: string) {
    this.addToast("warning", titre, message);
  }

  error(titre: string, message: string) {
    this.addToast("error", titre, message);
  }

  success(titre: string, message: string) {
    this.addToast("success", titre, message);
  }

  copy(titre: string, message?: string) {
    this.addToast("copy", titre, message);
  }

  private addToast(type: ToastType, title: string, message?: string) {
    const id = this.idCounter++;
    const toast: Toast = { id, type, title, message };

    // Auto-close after 4 seconds (as requested)
    toast.timeoutId = setTimeout(() => this.remove(id), 4000);

    const currentToasts = this.toastsSubject.value;
    // Max opened toasts limit (keep it to 3 like before, or just add and let CSS handle max)
    // We'll limit to 3. If more than 3, remove the oldest one.
    if (currentToasts.length >= 3) {
      const oldest = currentToasts[0];
      this.remove(oldest.id);
    }

    this.toastsSubject.next([...this.toastsSubject.value, toast]);
  }

  remove(id: number) {
    const currentToasts = this.toastsSubject.value;
    const toast = currentToasts.find((t) => t.id === id);
    if (toast && toast.timeoutId) {
      clearTimeout(toast.timeoutId);
    }
    this.toastsSubject.next(currentToasts.filter((t) => t.id !== id));
  }
}
