import { Component, OnInit, ViewChild } from '@angular/core';
import * as Chart from 'chart.js';
import * as ChartDataLabels from 'chartjs-plugin-datalabels';
import { DataService } from '../services/data.service';
import { CommitColor } from '../models/Commit.model';
import { BaseChartDirective } from 'ng2-charts';

@Component({
  selector: 'app-questions-completion-view',
  templateUrl: './questions-completion-view.component.html',
  styleUrls: ['./questions-completion-view.component.scss']
})
export class QuestionsCompletionViewComponent implements OnInit {
  @ViewChild(BaseChartDirective) myChart;

  today: Date;
  dict = {};
  tpGroup: string;
  chartLabels;
  chartOptions = {
    responsive: true,
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
            ].data.nb +
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
          ].data.students;
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
          // console.log(context);
          // console.log(context.chart.data.labels[context.dataIndex]);
          return (
            context.dataset.data[context.dataIndex].data.nb +
            ' (' +
            context.dataset.data[context.dataIndex].y.toFixed(2) +
            '%)'
          );
        }
      }
    }
  };

  chartData = [{ data: [] }];

  constructor(public dataService: DataService) {}

  loadGraphDataAndRefresh() {
    if (this.dataService.repositories) {
      this.initDict();
      this.loadQuestions();
    }
  }

  ngOnInit() {
    // Chart.pluginService.register(ChartDataLabels);
    this.today = this.dataService.lastUpdateDate;
    this.loadGraphDataAndRefresh();
  }

  initDict() {
    let questions = this.dataService.getQuestionsSet();
    questions.forEach(question => {
      this.dict[question] = {};
      [
        CommitColor.BEFORE.label,
        CommitColor.BETWEEN.label,
        CommitColor.AFTER.label,
        'NoCommit'
      ].forEach(color => {
        this.dict[question][color] = {
          nb: 0,
          students: []
        };
      });
    });
  }

  loadQuestions() {
    let repos = this.dataService.repositories.filter(
      repository => !this.tpGroup || repository.tpGroup === this.tpGroup
    );
    repos.forEach(repository => {
      repository.commits.forEach(commit => {
        if (commit.question) {
          if (
            !this.dict[commit.question][CommitColor.BEFORE.label].students
              .concat(
                this.dict[commit.question][CommitColor.BETWEEN.label].students,
                this.dict[commit.question][CommitColor.AFTER.label].students
              )
              .includes(repository.name)
          ) {
            this.dict[commit.question][commit.color.label].nb++;
            this.dict[commit.question][commit.color.label].students.push(
              repository.name
            );
          }
        }
      });
      this.dataService.getQuestionsSet().forEach(question => {
        if (
          !(
            this.dict[question][CommitColor.BEFORE.label].students.includes(
              repository.name
            ) ||
            this.dict[question][CommitColor.BETWEEN.label].students.includes(
              repository.name
            ) ||
            this.dict[question][CommitColor.AFTER.label].students.includes(
              repository.name
            )
          )
        ) {
          this.dict[question]['NoCommit'].nb++;
          this.dict[question]['NoCommit'].students.push(repository.name);
        }
      });
    });

    this.chartLabels = this.dataService.getQuestionsSet().sort();
    let data = [];

    data.push({
      label: 'Before review',
      backgroundColor: CommitColor.BEFORE.color, // green
      hoverBackgroundColor: CommitColor.BEFORE.color,
      borderColor: 'grey',
      data: this.chartLabels.map(label => {
        return {
          y:
            (this.dict[label][CommitColor.BEFORE.label].nb / repos.length) *
            100,
          data: this.dict[label][CommitColor.BEFORE.label]
        };
      })
    });

    data.push({
      label: 'Between review and correction',
      backgroundColor: CommitColor.BETWEEN.color, // orange
      hoverBackgroundColor: CommitColor.BETWEEN.color,
      borderColor: 'grey',
      data: this.chartLabels.map(label => {
        return {
          y:
            (this.dict[label][CommitColor.BETWEEN.label].nb / repos.length) *
            100,
          data: this.dict[label][CommitColor.BETWEEN.label]
        };
      })
    });

    data.push({
      label: 'After correction',
      backgroundColor: CommitColor.AFTER.color, // red
      hoverBackgroundColor: CommitColor.AFTER.color,
      borderColor: 'grey',
      data: this.chartLabels.map(label => {
        return {
          y:
            (this.dict[label][CommitColor.AFTER.label].nb / repos.length) * 100,
          data: this.dict[label][CommitColor.AFTER.label]
        };
      })
    });

    // this.chartData.push({
    //   label: 'Not finished',
    //   backgroundColor: 'grey', // grey
    //   borderColor: 'grey',
    //   data: this.chartLabels.map((label, index) => {
    //     return {
    //       y:
    //         100 -
    //         this.chartData[0].data[index].y -
    //         this.chartData[1].data[index].y -
    //         this.chartData[2].data[index].y,
    //       data: this.dict[label][CommitColor.AFTER.label]
    //     };
    //   })
    // });

    data.push({
      label: 'Not finished',
      backgroundColor: 'grey', // grey
      borderColor: 'grey',
      hoverBackgroundColor: 'grey',
      data: this.chartLabels.map(label => {
        return {
          y: (this.dict[label]['NoCommit'].nb / repos.length) * 100,
          data: this.dict[label]['NoCommit']
        };
      })
    });

    this.chartData = data;

    // console.log(this.chartData);
  }
}
