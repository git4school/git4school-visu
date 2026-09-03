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

    let currentToasts = this.toastsSubject.value;
    // Max opened toasts limit increased to 5 for better stacking visuals
    if (currentToasts.length >= 5) {
      const oldest = currentToasts[0];
      if (oldest.timeoutId) {
        clearTimeout(oldest.timeoutId);
      }
      currentToasts = currentToasts.filter((t) => t.id !== oldest.id);
    }

    this.toastsSubject.next([...currentToasts, toast]);
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
