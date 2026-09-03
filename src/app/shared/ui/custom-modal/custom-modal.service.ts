import {
  ApplicationRef,
  ComponentFactoryResolver,
  ComponentRef,
  EmbeddedViewRef,
  Injectable,
  Injector,
  Type,
} from "@angular/core";
import { CustomModalContainerComponent } from "./custom-modal-container/custom-modal-container.component";
import { CustomModalRef } from "./custom-modal-ref";

export interface CustomModalOptions {
  size?: "sm" | "md" | "lg" | "xl";
  beforeDismiss?: () => boolean | Promise<boolean>;
}

@Injectable({
  providedIn: "root",
})
export class CustomModalService {
  private openModalsCount = 0;

  constructor(
    private componentFactoryResolver: ComponentFactoryResolver,
    private appRef: ApplicationRef,
    private injector: Injector
  ) {}

  public hasOpenModals(): boolean {
    return this.openModalsCount > 0;
  }

  public open<T>(
    componentType: Type<T>,
    options: CustomModalOptions = {}
  ): CustomModalRef {
    this.openModalsCount++;
    // 1. Create the container component (the overlay and modal dialog)
    const containerFactory =
      this.componentFactoryResolver.resolveComponentFactory(
        CustomModalContainerComponent
      );
    const containerRef = containerFactory.create(this.injector);

    // Set options
    containerRef.instance.options = options;

    // Attach to ApplicationRef so change detection works
    this.appRef.attachView(containerRef.hostView);

    // Append to body
    const domElem = (containerRef.hostView as EmbeddedViewRef<any>)
      .rootNodes[0] as HTMLElement;
    document.body.appendChild(domElem);

    // 2. Create the CustomModalRef to represent the modal instance
    const customModalRef = new CustomModalRef(containerRef.instance);

    // 3. Set up the injector for the component to be loaded so it can inject CustomModalRef
    const customInjector = Injector.create({
      providers: [{ provide: CustomModalRef, useValue: customModalRef }],
      parent: this.injector,
    });

    // Force change detection so static ViewChild is resolved
    containerRef.changeDetectorRef.detectChanges();

    // 4. Load the target component inside the container using the custom injector
    const componentFactory =
      this.componentFactoryResolver.resolveComponentFactory(componentType);

    containerRef.instance.modalContent.clear();
    const contentRef = containerRef.instance.modalContent.createComponent(
      componentFactory,
      0,
      customInjector
    );
    customModalRef.componentInstance = contentRef.instance;

    // Handle backdrop clicks or programmatic dismiss via the container
    containerRef.instance.setDismissCallback(async (reason) => {
      let shouldDismiss = true;
      if (options.beforeDismiss) {
        shouldDismiss = await Promise.resolve(options.beforeDismiss());
      }

      if (shouldDismiss) {
        customModalRef.dismiss(reason);
      }
    });

    // Lock body scroll while modal is open
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Cleanup when modal closes
    customModalRef.result.finally(() => {
      this.openModalsCount = Math.max(0, this.openModalsCount - 1);
      document.body.style.overflow = previousBodyOverflow;
      this.appRef.detachView(containerRef.hostView);
      containerRef.destroy();
    });

    // Run change detection on the next tick so the caller has a chance to set inputs
    setTimeout(() => {
      contentRef.changeDetectorRef.detectChanges();
    });

    return customModalRef;
  }
}
