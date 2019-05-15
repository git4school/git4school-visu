import { Component, OnInit } from '@angular/core';
import { CommitsService } from '../services/commits.service';

@Component({
  selector: 'app-commit-list',
  templateUrl: './commit-list.component.html',
  styleUrls: ['./commit-list.component.scss']
})
export class CommitListComponent implements OnInit {
  commits: any[];
  loading = false;

  constructor(private commitsService: CommitsService) { }

  ngOnInit() {
    this.loading = true;
    this.commitsService.getCommits().subscribe(response => {
      this.loading = false;
      this.commits = response.slice();
    });
  }

}
