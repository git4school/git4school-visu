import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-repo-icon',
  templateUrl: './repo-icon.component.html',
  styleUrls: ['./repo-icon.component.scss']
})
export class RepoIconComponent {
  @Input() mode: 'default' | 'add' | 'add-multiple' | 'empty' = 'default';

  get viewBox(): string {
    switch (this.mode) {
      case 'add-multiple':
        return '0 0 147 216';
      case 'add':
        return '0 0 150 191';
      case 'empty':
        return '0 0 180 187';
      default:
        return '0 0 144 184';
    }
  }
}
