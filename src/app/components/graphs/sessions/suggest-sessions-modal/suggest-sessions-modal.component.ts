import { Component, Input, OnInit } from "@angular/core";
import { Session } from "@models/Session.model";
import { TranslateService } from "@ngx-translate/core";
import { SuggestedSessionResult } from "@services/session-analytics.service";
import { CustomModalRef } from "@shared/ui/custom-modal/custom-modal-ref";

export interface SelectableSuggestedSession {
  item: SuggestedSessionResult;
  selected: boolean;
  label: string;
  placeholder: string;
}

@Component({
  selector: "app-suggest-sessions-modal",
  templateUrl: "./suggest-sessions-modal.component.html",
  styleUrls: ["./suggest-sessions-modal.component.scss"],
})
export class SuggestSessionsModalComponent implements OnInit {
  @Input() suggestions: SuggestedSessionResult[] = [];

  selectableItems: SelectableSuggestedSession[] = [];

  constructor(
    public activeModalService: CustomModalRef,
    public translateService: TranslateService
  ) {}

  ngOnInit(): void {
    this.selectableItems = (this.suggestions || []).map((s) => ({
      item: s,
      selected: true,
      label: "",
      placeholder: s.suggestedLabel || "Séance",
    }));
  }

  get selectedCount(): number {
    return this.selectableItems.filter((s) => s.selected).length;
  }

  get allSelected(): boolean {
    return (
      this.selectableItems.length > 0 &&
      this.selectableItems.every((s) => s.selected)
    );
  }

  toggleSelectAll(): void {
    const targetState = !this.allSelected;
    this.selectableItems.forEach((s) => (s.selected = targetState));
  }

  confirm(): void {
    const selectedSessions: Session[] = this.selectableItems
      .filter((s) => s.selected)
      .map((s) => {
        const session = s.item.session;
        const custom = s.label?.trim();
        session.label = custom && custom.length > 0 ? custom : undefined;
        return session;
      });

    this.activeModalService.close(selectedSessions);
  }

  dismiss(): void {
    this.activeModalService.dismiss();
  }
}
