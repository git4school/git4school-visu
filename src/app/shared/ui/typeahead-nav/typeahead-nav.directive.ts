import { Directive, ElementRef, HostListener, NgZone, OnDestroy, Renderer2 } from "@angular/core";

/**
 * Directive automatically applied to inputs with ngbTypeahead.
 * Prevents visual jump/conflict during keyboard arrow navigation:
 * when arrow keys are pressed, temporarily suppresses pointer events on the typeahead window
 * so synthetic mouseenter events from stationary cursors cannot steal or flicker the selection.
 */
@Directive({
  selector: "input[ngbTypeahead]",
})
export class TypeaheadKeyboardNavDirective implements OnDestroy {
  private isKeyboardNav = false;
  private lastMouseX = -1;
  private lastMouseY = -1;
  private removeMouseMoveListener: (() => void) | null = null;
  private removeMouseDownListener: (() => void) | null = null;
  private removeWheelListener: (() => void) | null = null;

  constructor(private elementRef: ElementRef<HTMLInputElement>, private renderer: Renderer2, private ngZone: NgZone) {}

  @HostListener("keydown", ["$event"])
  onKeyDown(event: KeyboardEvent): void {
    if (
      event.key === "ArrowDown" ||
      event.key === "Down" ||
      event.key === "ArrowUp" ||
      event.key === "Up" ||
      event.key === "PageDown" ||
      event.key === "PageUp"
    ) {
      this.enterKeyboardNav();
    } else if (event.key === "Escape" || event.key === "Enter" || event.key === "Tab") {
      this.exitKeyboardNav();
    }
  }

  @HostListener("blur")
  onBlur(): void {
    this.exitKeyboardNav();
  }

  ngOnDestroy(): void {
    this.exitKeyboardNav();
  }

  /**
   * Enter keyboard navigation mode.
   * Disables pointer events and transitions on typeahead dropdown.
   */
  private enterKeyboardNav(): void {
    if (this.isKeyboardNav) {
      return;
    }

    if (typeof document === "undefined") {
      return;
    }

    const hasWindow = !!document.querySelector("ngb-typeahead-window");
    if (!hasWindow) {
      return;
    }

    this.isKeyboardNav = true;
    this.renderer.addClass(document.body, "typeahead-keyboard-nav");

    this.ngZone.runOutsideAngular(() => {
      this.lastMouseX = -1;
      this.lastMouseY = -1;

      const onMouseMove = (e: MouseEvent) => {
        if (this.lastMouseX === -1 && this.lastMouseY === -1) {
          this.lastMouseX = e.clientX;
          this.lastMouseY = e.clientY;
          return;
        }
        const deltaX = Math.abs(e.clientX - this.lastMouseX);
        const deltaY = Math.abs(e.clientY - this.lastMouseY);
        if (deltaX > 2 || deltaY > 2) {
          this.exitKeyboardNav();
        }
      };

      const onMouseDown = () => {
        this.exitKeyboardNav();
      };

      const onWheel = () => {
        this.exitKeyboardNav();
      };

      document.addEventListener("mousemove", onMouseMove, true);
      document.addEventListener("mousedown", onMouseDown, true);
      window.addEventListener("wheel", onWheel, true);

      this.removeMouseMoveListener = () => document.removeEventListener("mousemove", onMouseMove, true);
      this.removeMouseDownListener = () => document.removeEventListener("mousedown", onMouseDown, true);
      this.removeWheelListener = () => window.removeEventListener("wheel", onWheel, true);
    });
  }

  /**
   * Exit keyboard navigation mode and detach transient listeners.
   */
  private exitKeyboardNav(): void {
    if (!this.isKeyboardNav) {
      return;
    }
    this.isKeyboardNav = false;

    if (typeof document !== "undefined") {
      this.renderer.removeClass(document.body, "typeahead-keyboard-nav");
    }

    if (this.removeMouseMoveListener) {
      this.removeMouseMoveListener();
      this.removeMouseMoveListener = null;
    }
    if (this.removeMouseDownListener) {
      this.removeMouseDownListener();
      this.removeMouseDownListener = null;
    }
    if (this.removeWheelListener) {
      this.removeWheelListener();
      this.removeWheelListener = null;
    }
  }
}
