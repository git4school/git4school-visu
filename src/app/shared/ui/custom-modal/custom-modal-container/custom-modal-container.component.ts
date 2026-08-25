import {
  ChangeDetectorRef,
  Component,
  ComponentFactoryResolver,
  ComponentRef,
  ElementRef,
  HostListener,
  OnInit,
  Type,
  ViewChild,
  ViewContainerRef,
} from "@angular/core";

@Component({
  selector: "app-custom-modal-container",
  templateUrl: "./custom-modal-container.component.html",
  styleUrls: ["./custom-modal-container.component.scss"],
})
export class CustomModalContainerComponent implements OnInit {
  @ViewChild("modalContent", { read: ViewContainerRef, static: true })
  modalContent: ViewContainerRef;

  public animationState: "void" | "enter" | "leave" = "void";
  public options: {
    size?: "sm" | "md" | "lg" | "xl";
    beforeDismiss?: () => boolean | Promise<boolean>;
  } = {};

  private componentRef: ComponentRef<any>;
  private dismissCallback: (reason?: any) => void;

  constructor(
    private componentFactoryResolver: ComponentFactoryResolver,
    private elementRef: ElementRef,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Double requestAnimationFrame ensures browser paints initial frame before triggering transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.animationState = "enter";
        this.cdr.detectChanges();
      });
    });
  }

  @HostListener("document:keydown.escape", ["$event"])
  onEscapeKey(event: KeyboardEvent) {
    if (this.animationState === "enter" && this.dismissCallback) {
      event.preventDefault();
      this.dismissCallback("escape");
    }
  }

  public loadComponent<T>(componentType: Type<T>): T {
    const componentFactory =
      this.componentFactoryResolver.resolveComponentFactory(componentType);
    this.modalContent.clear();
    this.componentRef = this.modalContent.createComponent(componentFactory);
    return this.componentRef.instance;
  }

  public setDismissCallback(callback: (reason?: any) => void) {
    this.dismissCallback = callback;
  }

  public onBackdropClick() {
    if (this.dismissCallback) {
      this.dismissCallback("backdrop click");
    }
  }

  public onModalClick(event: Event) {
    event.stopPropagation(); // Prevent backdrop click when clicking inside the modal
  }

  public destroyModal(): Promise<void> {
    return new Promise((resolve) => {
      this.animationState = "leave";
      this.cdr.detectChanges();
      // Synchronized with $transition-drawer-exit (200ms)
      setTimeout(() => {
        resolve();
      }, 200);
    });
  }
}
