import { Component } from '@angular/core';
import { Milestone } from '@models/Milestone.model';
import { Repository } from '@models/Repository.model';
import { LoaderService } from '@services/loader.service';

@Component({
    template: ``
})
export abstract class BaseGraphComponent {
    public loading = false;

    constructor(protected loaderService: LoaderService) {

    }

    abstract loadGraph(startDate?: string, endDate?: string);

    loadGraphMetadata(repositories: Repository[], reviews: Milestone[], corrections: Milestone[], questions) {
        this.loaderService.loadCommitsMetadata(repositories, reviews, corrections, questions);
        this.loadGraphDataAndRefresh();
    }

    abstract loadGraphDataAndRefresh();
}