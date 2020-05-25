import { Component, OnInit } from '@angular/core';
import { ClipboardService } from 'ngx-clipboard';
import { HttpClient } from '@angular/common/http';

/**
 * This component is used for the Home page displaying useful information such as CHANGELOG,
 * a user guide or help with the structure of the configuration file or the ReadMe of the repositories
 */
@Component({
  selector: 'home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  /**
   * HomeComponent constructor
   * @param clipboardService
   * @param http
   */
  constructor(
    private clipboardService: ClipboardService,
    private http: HttpClient
  ) { }

  /**
   * A variable used to get and display CHANGELOG directly from the repository
   */
  changelog;

  /**
   * A variable used to display the readMe structure
   */
  readMe = `# First IT practical

### NOM : DOE
### Prénom : John
### Groupe de TP : 
- [ ] 11
- [x] 12
- [ ] 21
- [ ] 22`;

  /**
   * When the component is initialized, we call getChangelog()
   */
  ngOnInit() {
    this.getChangelog();
  }

  /**
   * Gets CHANGELOG file from the git4school repository and update the changelog variable
   */
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

  /**
   * Sets the example of the JSON structure in the clipboard
   */
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

  /**
   * Sets the example of the ReadMe structure in the clipboard
   */
  copyReadMe() {
    this.clipboardService.copyFromContent(this.readMe);
  }
}
