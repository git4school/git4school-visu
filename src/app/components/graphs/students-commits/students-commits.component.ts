import { Component, OnInit } from '@angular/core';
import { DataProvidedGuard } from '@guards/data-provided.guard';
import { CommitColor } from '@models/Commit.model';
import { TranslateService } from '@ngx-translate/core';
import { CommitsService } from '@services/commits.service';
import { DataService } from '@services/data.service';
import { LoaderService } from '@services/loader.service';
import * as Chart from 'chart.js';
//import * as ChartDataLabels from 'chartjs-plugin-datalabels';
import { default as ChartDataLabels } from 'chartjs-plugin-datalabels';
import { BaseGraphComponent } from '../base-graph.component';

/**
 * jquery
 */
declare var $: any;

/**
 * This component displays a graph with the distribution of commit types for each student
 */
@Component({
  selector: 'students-commits',
  templateUrl: './students-commits.component.html',
  styleUrls: ['./students-commits.component.scss']
})
export class StudentsCommitsComponent extends BaseGraphComponent implements OnInit {
  /**
   * The date after which the commits will not be considered, this shows the state of work of each student on a given date
   */
  date: number;

  /**
   * The minimum date that can be traced back to, in the form of a timestamp.
   * It corresponds to the date of the most recent commit among all the repositories
   */
  min: number;

  /**
   * The maximum date that can be traced back to, in the form of a timestamp.
   * It corresponds to the last update date
   */
  max: number;

  /**
   * The data about students
   */
  dict = [];

  /**
   * The filter on the tp group of repositories
   */
  tpGroup: string;

  /**
   * The graph labels, which corresponds to the repositories name
   */
  chartLabels = [];

  /**
   * The options for chart js
   */
  chartOptions = {
    layout: {
      padding: {
        top: 10
      }
    },
    responsive: true,
    aspectRatio: 2.4,
    animation: {
      duration: 0 // general animation time
    },
    responsiveAnimationDuration: 0,
    legend: {
      position: 'bottom'
    },
    tooltips: {
      mode: 'nearest',
      position: 'average',
      callbacks: {
        beforeTitle(tooltipItem, data) {
          return (
            data.datasets[tooltipItem[0].datasetIndex].data[
              tooltipItem[0].index
            ].translations['STUDENT'] +
            ' : ' +
            tooltipItem[0].label
          );
        },
        title(tooltipItem, data) {
          return data.datasets[tooltipItem[0].datasetIndex].label;
        },
        beforeBody(tooltipItem, data) {
          return (
            '\n' +
            data.datasets[tooltipItem[0].datasetIndex].data[
              tooltipItem[0].index
            ].translations['COMMITS-COUNT'] +
            ' : ' +
            data.datasets[tooltipItem[0].datasetIndex].data[
              tooltipItem[0].index
            ].data.commitsCount +
            '\n' +
            data.datasets[tooltipItem[0].datasetIndex].data[
              tooltipItem[0].index
            ].translations['COMMITS-PERCENTAGE'] +
            ' : ' +
            tooltipItem[0].yLabel.toFixed(2) +
            '%'
          );
        },
        label(tooltipItem, data) {
          return '';
        }
      },
      displayColors: false
    },
    scales: {
      xAxes: [
        {
          stacked: true
        }
      ],
      yAxes: [
        {
          id: 'A',
          type: 'linear',
          stacked: true,
          position: 'left',
          scaleLabel: {
            display: true,
            labelString: '% of commits'
          },
          ticks: {
            max: 100
          }
        },
        {
          id: 'B',
          type: 'category',
          position: 'right',
          offset: true,
          scaleLabel: {
            display: true,
            labelString: 'Question progression'
          },
          gridLines: {
            display: false
          },
          labels: this.dataService.questions
            ? this.dataService.questions.slice().reverse()
            : []
        },
        {
          id: 'C',
          stacked: true,
          offset: true,
          type: 'linear',
          display: false
        }
      ]
    },
    annotation: {
      annotations: [
        {
          drawTime: 'afterDatasetsDraw',
          id: 'hline',
          type: 'line',
          mode: 'horizontal',
          scaleID: 'y-axis-0',
          value: 28.25,
          borderColor: 'black',
          borderWidth: 5,
          label: {
            backgroundColor: 'red',
            content: 'Test Label',
            enabled: true
          }
        }
      ]
    },
    plugins: {
      datalabels: {
        clip: false,
        color: 'white',
        font: {
          weight: 'bold'
        },
        backgroundColor: function (context) {
          return context.dataset.backgroundColor;
        },
        borderRadius: 4,
        display: false,
        formatter: function (value, context) {
          return context.dataset.data[context.dataIndex].y;
        }
      }
    }
  };

  /**
   * The data for chart js
   */
  chartData = [{ data: [] }];

  /**
   * StudentsCommitsComponent constructor
   * @param dataService Service used to store and get data
   * @param commitsService Service used to update dict variable
   * @param translateService Service used to translate the application
   * @param dataProvided Guard used to know if data is loaded
   */
  constructor(
    public dataService: DataService,
    private commitsService: CommitsService,
    public translateService: TranslateService,
    public dataProvided: DataProvidedGuard,
    protected loaderService: LoaderService
  ) { super(loaderService); }

  /**
   * Updates dict variable with students data and loads graph labels which displays data on the graph
   */
  loadGraphDataAndRefresh() {
    if (this.dataProvided.dataLoaded()) {
      let translations = this.translateService
        .instant(['STUDENT', 'COMMITS-COUNT', 'COMMITS-PERCENTAGE']);
      let colors = [
        CommitColor.INTERMEDIATE,
        CommitColor.BEFORE,
        CommitColor.BETWEEN,
        CommitColor.AFTER
      ];

      this.chartLabels = this.loadLabels();
      let dict = this.commitsService.loadStudentsDict(
        this.dataService.repositories,
        this.dataService.questions,
        colors,
        this.tpGroup,
        this.date
      );
      this.chartData = this.commitsService.loadStudents(
        dict,
        colors,
        translations
      );
    }
  }

  /**
   * Loads graph labels with the repositories name
   */
  loadLabels(): any[] {
    return this.dataService.repositories
      .filter(
        repository => !this.tpGroup || repository.tpGroup === this.tpGroup
      )
      .map(repository => repository.name);
  }

  /**
   * When the component is initialized, we register the ChartDataLabels plugin for ChartJs, we initialize date, max and min
   * and we call loadGraphDataAndRefresh()
   */
  ngOnInit() {
    Chart.pluginService.register(ChartDataLabels);

    setTimeout(() => {
      this.translateService.onLangChange.subscribe(() => {
        this.loadGraphDataAndRefresh();
      });

      if (this.dataService.repoToLoad) {
        console.log('LOADGRAPH');
        this.loadGraph(this.dataService.startDate, this.dataService.endDate);
      } else {
        this.loading = true;
        this.dataService.lastUpdateDate &&
          ((this.date = this.dataService.lastUpdateDate.getTime()) &&
            (this.max = this.date) &&
            (this.min = this.getMinDateTimestamp()));
        this.loadGraphMetadata(this.dataService.repositories, this.dataService.reviews, this.dataService.corrections, this.dataService.questions);
        this.loading = false;
      }

    });
  }

  loadGraph(startDate?: string, endDate?: string) {
    this.loading = true;
    this.loaderService.loadRepositories(startDate, endDate).subscribe(() => {
      this.dataService.lastUpdateDate &&
        ((this.date = this.dataService.lastUpdateDate.getTime()) &&
          (this.max = this.date) &&
          (this.min = this.getMinDateTimestamp()));
      this.loadGraphMetadata(this.dataService.repositories, this.dataService.reviews, this.dataService.corrections, this.dataService.questions);
      this.loading = false;
    });
  }

  /**
   * When the component is destroyed, we unregister the ChartDataLabels plugin for ChartJs
   */
  ngOnDestroy() {
    Chart.pluginService.unregister(ChartDataLabels);
  }

  /**
   * Returns the minimum date needed by the date slider
   * @returns A timestamp corresponding to the minimum date selectable with the date slider
   */
  getMinDateTimestamp() {
    let commits = [];
    this.dataService.repositories.forEach(repository => {
      commits = commits.concat(repository.commits);
    });
    let min = commits.reduce(
      (min, commit) =>
        commit.commitDate.getTime() < min.getTime() ? commit.commitDate : min,
      commits[0].commitDate
    );
    return min.getTime();
  }
}
