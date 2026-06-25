import {
  Component,
  ComponentFactoryResolver,
  ComponentRef,
  ElementRef,
  Type,
  ViewChild,
  ViewContainerRef
} from '@angular/core';

@Component({
  selector: 'app-custom-modal-container',
  templateUrl: './custom-modal-container.component.html',
  styleUrls: ['./custom-modal-container.component.scss']
})
export class CustomModalContainerComponent {
  @ViewChild('modalContent', { read: ViewContainerRef, static: true }) modalContent: ViewContainerRef;

  public animationState: 'void' | 'enter' | 'leave' = 'enter';
  public options: { size?: 'sm' | 'md' | 'lg' | 'xl'; beforeDismiss?: () => boolean | Promise<boolean> } = {};

  private componentRef: ComponentRef<any>;
  private dismissCallback: (reason?: any) => void;

  constructor(
    private componentFactoryResolver: ComponentFactoryResolver,
    private elementRef: ElementRef
  ) {}

  public loadComponent<T>(componentType: Type<T>): T {
    const componentFactory = this.componentFactoryResolver.resolveComponentFactory(componentType);
    this.modalContent.clear();
    this.componentRef = this.modalContent.createComponent(componentFactory);
    return this.componentRef.instance;
  }

  public setDismissCallback(callback: (reason?: any) => void) {
    this.dismissCallback = callback;
  }

  public onBackdropClick() {
    if (this.dismissCallback) {
      this.dismissCallback('backdrop click');
    }
  }

  public onModalClick(event: Event) {
    event.stopPropagation(); // Prevent backdrop click when clicking inside the modal
  }

  public destroyModal(): Promise<void> {
    return new Promise((resolve) => {
      this.animationState = 'leave';
      // Wait for animation to finish
      setTimeout(() => {
        resolve();
      }, 300); // 300ms matches the CSS transition duration
    });
  }
}
