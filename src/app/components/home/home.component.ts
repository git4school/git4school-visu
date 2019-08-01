import { Component, OnInit } from '@angular/core';
import { ClipboardService } from 'ngx-clipboard';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  constructor(
    private clipboardService: ClipboardService,
    private http: HttpClient
  ) {}

  changelog;
  readMe = `# First IT practical

### NOM : DOE
### Prénom : John
### Groupe de TP : 
- [ ] 11
- [x] 12
- [ ] 21
- [ ] 22`;

  ngOnInit() {
    this.getChangelog();
  }

  getChangelog() {
    this.http
      .get(
        'https://api.github.com/repos/git4school/git4school-visu/contents/CHANGELOG.md'
      )
      .subscribe(data => {
        this.changelog = decodeURIComponent(
          escape(window.atob(data['content']))
        );
      });
  }

  copyJSON() {
    this.clipboardService.copyFromContent(`
{
  "title": "TP title",
  "course": "JEE",
  "program": "Master 1 DL",
  "year": "2018-2019",
  "startDate": "2017-01-22 12:00",
  "endDate": "2018-04-23 12:00",
  "questions": ["1.1", "1.2"],
  "repositories": [
    { "url": "https://github.com/user/repository", "name": "First name LAST NAME", "tpGroup": "12" }
  ],
  "sessions": [
    {
      "startDate": "2019-05-22 10:00",
      "endDate": "2019-05-22 11:00", 
      "tpGroup": "11"
    }
  ],
  "reviews": [
    { "date": "2019-03-15 15:40", "label": "Review 1", "tpGroup": "21", "questions": ["1.1", "1.2"] }
  ],
  "corrections": [
    { "date": "2019-03-17 15:40", "label": "Correction 1", "tpGroup": "22", "questions": ["1.1", "1.2"] }
  ],
  "others": [
    {"date": "2019-03-19 15:40", "label": "Other 1", "tpGroup": "12", "questions": [] }
  ]
}`);
  }

  copyReadMe() {
    this.clipboardService.copyFromContent(this.readMe);
  }
}
