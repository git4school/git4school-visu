import { Component, OnInit, ViewChild } from '@angular/core';
import * as Chart from 'chart.js';
import * as ChartDataLabels from 'chartjs-plugin-datalabels';
import { DataService } from '../services/data.service';
import { CommitColor } from '../models/Commit.model';
import { BaseChartDirective } from 'ng2-charts';
import { CommitsService } from '../services/commits.service';
declare var $: any;

@Component({
  selector: 'app-questions-completion-view',
  templateUrl: './questions-completion-view.component.html',
  styleUrls: ['./questions-completion-view.component.scss']
})
export class QuestionsCompletionViewComponent implements OnInit {
  @ViewChild(BaseChartDirective) myChart;

  date: number;
  min: number;
  max: number;
  dict = {};
  tpGroup: string;
  chartLabels;
  chartOptions = {
    responsive: true,
    animation: {
      duration: 0 // general animation time
    },
    responsiveAnimationDuration: 0,
    aspectRatio: 2.4,
    legend: {
      position: 'bottom'
    },
    tooltips: {
      mode: 'nearest',
      position: 'average',
      callbacks: {
        beforeTitle(tooltipItem, data) {
          return 'Question : ' + tooltipItem[0].label;
        },
        title(tooltipItem, data) {
          return data.datasets[tooltipItem[0].datasetIndex].label;
        },
        beforeBody(tooltipItem, data) {
          return (
            '\nCommits count : ' +
            data.datasets[tooltipItem[0].datasetIndex].data[
              tooltipItem[0].index
            ].data.count +
            '\nCommits pourcentage : ' +
            tooltipItem[0].yLabel.toFixed(2) +
            '%'
          );
        },
        label(tooltipItem, data) {
          return '';
        },
        footer(tooltipItem, data) {
          return data.datasets[tooltipItem[0].datasetIndex].data[
            tooltipItem[0].index
          ].data.students.map(student => student.name);
        }
      },
      displayColors: false
    },
    title: {
      display: false,
      text: 'Chart.js Bar Chart - Stacked'
    },
    scales: {
      xAxes: [
        {
          stacked: true,
          scaleLabel: {
            display: true,
            labelString: 'Questions'
          }
        }
      ],
      yAxes: [
        {
          stacked: true,
          ticks: {
            max: 100
          },
          scaleLabel: {
            display: true,
            labelString: '% of commits'
          },
          gridLines: {
            lineWidth: [1, 1, 1, 1, 1, 5, 1, 1, 1, 1],
            color: [
              'rgba(0, 0, 0, 0.1)',
              'rgba(0, 0, 0, 0.1)',
              'rgba(0, 0, 0, 0.1)',
              'rgba(0, 0, 0, 0.1)',
              'rgba(0, 0, 0, 0.1)',
              CommitColor.AFTER.color,
              'rgba(0, 0, 0, 0.1)',
              'rgba(0, 0, 0, 0.1)',
              'rgba(0, 0, 0, 0.1)',
              'rgba(0, 0, 0, 0.1)'
            ],
            zeroLineWidth: 0
          }
        }
      ]
    },
    plugins: {
      datalabels: {
        clamp: true,
        clip: 'auto',
        color: 'white',
        display: function(context) {
          return context.dataset.data[context.dataIndex].y > 3;
        },
        font: {
          weight: 'bold'
        },
        backgroundColor: function(context) {
          return context.dataset.backgroundColor;
        },
        borderRadius: 4,
        formatter: function(value, context) {
          return (
            context.dataset.data[context.dataIndex].data.count +
            ' (' +
            context.dataset.data[context.dataIndex].y.toFixed(2) +
            '%)'
          );
        }
      }
    }
  };

  chartData = [{ data: [] }];

  constructor(
    public dataService: DataService,
    private commitsService: CommitsService
  ) {}

  loadGraphDataAndRefresh() {
    if (this.dataService.repositories) {
      this.chartLabels = this.dataService.questions;
      let colors = [
        CommitColor.BEFORE,
        CommitColor.BETWEEN,
        CommitColor.AFTER,
        CommitColor.NOCOMMIT
      ];

      let dict = this.commitsService.initQuestionsDict(
        this.dataService.questions,
        colors
      );
      dict = this.commitsService.loadQuestionsDict(
        dict,
        this.dataService.repositories,
        this.dataService.questions,
        colors,
        this.tpGroup,
        this.date
      );

      this.chartData = this.commitsService.loadQuestions(
        dict,
        colors,
        this.dataService.questions
      );
    }
  }

  ngOnInit() {
    $('#dateSlider').tooltip();
    this.dataService.lastUpdateDate &&
      ((this.date = this.dataService.lastUpdateDate.getTime()) &&
        (this.max = this.date) &&
        (this.min = this.getMinDateTimestamp()));
    this.loadGraphDataAndRefresh();
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
