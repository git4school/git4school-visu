import { Component, OnInit } from '@angular/core';
import { CommitsService } from '../services/commits.service';
import { Commit } from '../models/Commit.model';

@Component({
  selector: 'app-commit-list',
  templateUrl: './commit-list.component.html',
  styleUrls: ['./commit-list.component.scss']
})
export class CommitListComponent implements OnInit {
  commits: Commit[];
  loading = false;

  constructor(private commitsService: CommitsService) { }

  ngOnInit() {
    this.loading = true;
    this.commitsService.getCommits('https://api.github.com/repos/BilelJegham/AIDEPSYCHO/commits').subscribe(response => {
      this.loading = false;
      this.commits = response.slice();
      console.log(this.commits);
    });
  }

}
