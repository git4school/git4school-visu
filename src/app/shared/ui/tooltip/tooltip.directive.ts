import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  TemplateRef,
} from "@angular/core";
import { TooltipService } from "../../../services/tooltip.service";

@Directive({
  selector: "[appTooltip]",
})
export class TooltipDirective implements OnDestroy {
  @Input("appTooltip") content:
    | string
    | TemplateRef<any>
    | { text: string | TemplateRef<any>; shortcut?: string[] } = "";
  @Input() placement: "top" | "bottom" | "left" | "right" = "top";

  constructor(
    private elementRef: ElementRef,
    private tooltipService: TooltipService
  ) {}

  @HostListener("mouseenter")
  onMouseEnter() {
    let text: string | TemplateRef<any> = "";
    let shortcut: string[] | undefined;

    if (
      typeof this.content === "string" ||
      this.content instanceof TemplateRef
    ) {
      text = this.content;
    } else if (this.content) {
      text = this.content.text;
      shortcut = this.content.shortcut;
    }

    if (text) {
      this.tooltipService.show(
        text,
        this.elementRef.nativeElement,
        this.placement,
        shortcut
      );
    }
  }

  @HostListener("mouseleave")
  onMouseLeave() {
    this.tooltipService.hide();
  }

  @HostListener("window:blur")
  onWindowBlur() {
    this.tooltipService.hide();
  }

  ngOnDestroy() {
    this.tooltipService.hide();
  }
}
