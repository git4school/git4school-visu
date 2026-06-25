import { Injectable, ComponentFactoryResolver, ApplicationRef, Injector, EmbeddedViewRef, ComponentRef, TemplateRef } from '@angular/core';
import { TooltipComponent } from '../shared/ui/tooltip/tooltip.component';

@Injectable({
  providedIn: 'root'
})
export class TooltipService {
  private tooltipComponentRef: ComponentRef<TooltipComponent> | null = null;
  private showTimeout: any;
  private readonly SHOW_DELAY = 500; // ms

  constructor(
    private componentFactoryResolver: ComponentFactoryResolver,
    private appRef: ApplicationRef,
    private injector: Injector
  ) {}

  /**
   * Shows a tooltip relative to an HTMLElement
   */
  show(content: string | TemplateRef<any>, element: HTMLElement, placement: 'top' | 'bottom' | 'left' | 'right' = 'top', shortcutKeys?: string[]) {
    this.hide(); // Hide any existing tooltip immediately

    this.showTimeout = setTimeout(() => {
      this.tooltipComponentRef = this.createTooltipComponent(content, placement, shortcutKeys);
      
      // Calculate position
      const rect = element.getBoundingClientRect();
      this.setPosition(rect, placement).then(() => {
        this.tooltipComponentRef?.instance.reveal();
      });
    }, this.SHOW_DELAY);
  }

  /**
   * Shows a tooltip at specific coordinates (useful for D3/Chart.js)
   */
  showAtPosition(content: string | TemplateRef<any>, x: number, y: number, placement: 'top' | 'bottom' | 'left' | 'right' = 'top', shortcutKeys?: string[], instant: boolean = false) {
    this.hide();

    const render = () => {
      this.tooltipComponentRef = this.createTooltipComponent(content, placement, shortcutKeys);
      
      // Simulate a rect for position calculation
      const rect = {
        top: y,
        bottom: y,
        left: x,
        right: x,
        width: 0,
        height: 0
      } as DOMRect;
      
      this.setPosition(rect, placement).then(() => {
        this.tooltipComponentRef?.instance.reveal();
      });
    };

    if (instant) {
      render();
    } else {
      this.showTimeout = setTimeout(render, this.SHOW_DELAY);
    }
  }

  isShowing(): boolean {
    return this.tooltipComponentRef !== null;
  }

  moveTooltip(x: number, y: number, placement: 'top' | 'bottom' | 'left' | 'right' = 'top') {
    if (this.tooltipComponentRef) {
      const rect = {
        top: y,
        bottom: y,
        left: x,
        right: x,
        width: 0,
        height: 0
      } as DOMRect;
      this.setPosition(rect, placement);
    }
  }

  hide() {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
    }
    
    if (this.tooltipComponentRef) {
      this.appRef.detachView(this.tooltipComponentRef.hostView);
      this.tooltipComponentRef.destroy();
      this.tooltipComponentRef = null;
    }
  }

  private createTooltipComponent(content: string | TemplateRef<any>, placement: 'top' | 'bottom' | 'left' | 'right', shortcutKeys?: string[]): ComponentRef<TooltipComponent> {
    const componentFactory = this.componentFactoryResolver.resolveComponentFactory(TooltipComponent);
    const componentRef = componentFactory.create(this.injector);

    componentRef.instance.content = content;
    componentRef.instance.placement = placement;
    if (shortcutKeys) {
      componentRef.instance.shortcutKeys = shortcutKeys;
    }

    this.appRef.attachView(componentRef.hostView);
    const domElem = (componentRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
    document.body.appendChild(domElem);

    return componentRef;
  }

  private setPosition(rect: DOMRect, placement: 'top' | 'bottom' | 'left' | 'right'): Promise<void> {
    return new Promise(resolve => {
      if (!this.tooltipComponentRef) {
        resolve();
        return;
      }
      
      const domElem = (this.tooltipComponentRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
      
      // We need to render it slightly offscreen to get its dimensions if not already known, 
      // but the position is absolute, so we can just set it. 
      // In Angular, sometimes we need to wait a tick for DOM update to get the size of the tooltip itself.
      // We'll use a fast approach:
      setTimeout(() => {
        if (!this.tooltipComponentRef) {
          resolve();
          return;
        }

        const tooltipRect = domElem.getBoundingClientRect();
        let top = 0;
        let left = 0;
        const offset = 8; // distance from element

        switch (placement) {
          case 'top':
            top = rect.top - tooltipRect.height - offset;
            left = rect.left + (rect.width - tooltipRect.width) / 2;
            break;
          case 'bottom':
            top = rect.bottom + offset;
            left = rect.left + (rect.width - tooltipRect.width) / 2;
            break;
          case 'left':
            top = rect.top + (rect.height - tooltipRect.height) / 2;
            left = rect.left - tooltipRect.width - offset;
            break;
          case 'right':
            top = rect.top + (rect.height - tooltipRect.height) / 2;
            left = rect.right + offset;
            break;
        }

        // Add scroll offset
        top += window.scrollY;
        left += window.scrollX;

        // Basic bounds checking
        if (left < 0) left = 8;
        if (top < 0) top = 8;
        if (left + tooltipRect.width > window.innerWidth) left = window.innerWidth - tooltipRect.width - 8;

        domElem.style.top = `${top}px`;
        domElem.style.left = `${left}px`;
        resolve();
      });
    });
  }
}
