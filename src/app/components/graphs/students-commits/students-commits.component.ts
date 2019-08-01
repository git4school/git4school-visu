import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import * as Chart from 'chart.js';
import * as ChartDataLabels from 'chartjs-plugin-datalabels';

import { CommitColor, Commit } from '@models/Commit.model';
import { CommitsService } from '@services/commits.service';
import { DataService } from '@services/data.service';
import { DataProvidedGuard } from '@guards/data-provided.guard';
declare var $: any;

@Component({
  selector: 'students-commits',
  templateUrl: './students-commits.component.html',
  styleUrls: ['./students-commits.component.scss']
})
export class StudentsCommitsComponent implements OnInit {
  date: number;
  min: number;
  max: number;
  dict = [];
  tpGroup: string;
  chartLabels = [];
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
          return 'Student : ' + tooltipItem[0].label;
        },
        title(tooltipItem, data) {
          return data.datasets[tooltipItem[0].datasetIndex].label;
        },
        beforeBody(tooltipItem, data) {
          return (
            '\nCommits count : ' +
            data.datasets[tooltipItem[0].datasetIndex].data[
              tooltipItem[0].index
            ].data.commitsCount +
            '\nCommits pourcentage : ' +
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
        backgroundColor: function(context) {
          return context.dataset.backgroundColor;
        },
        borderRadius: 4,
        display: false,
        formatter: function(value, context) {
          return context.dataset.data[context.dataIndex].y;
        }
      }
    }
  };

  chartData = [{ data: [] }];

  constructor(
    public dataService: DataService,
    private commitsService: CommitsService,
    public translate: TranslateService,
    public dataProvided: DataProvidedGuard
  ) {}

  loadGraphDataAndRefresh() {
    if (this.dataProvided.dataLoaded()) {
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
      this.chartData = this.commitsService.loadStudents(dict, colors);
    }
  }
  loadLabels(): any[] {
    return this.dataService.repositories
      .filter(
        repository => !this.tpGroup || repository.tpGroup === this.tpGroup
      )
      .map(repository => repository.name);
  }

  ngOnInit() {
    Chart.pluginService.register(ChartDataLabels);
    this.dataService.lastUpdateDate &&
      ((this.date = this.dataService.lastUpdateDate.getTime()) &&
        (this.max = this.date) &&
        (this.min = this.getMinDateTimestamp()));
    this.loadGraphDataAndRefresh();
  }

  ngOnDestroy() {
    Chart.pluginService.unregister(ChartDataLabels);
  }

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
