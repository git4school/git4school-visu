import { Component, OnInit } from '@angular/core';
import * as Chart from 'chart.js';
import * as ChartDataLabels from 'chartjs-plugin-datalabels';
import { DataService } from '../services/data.service';
import { CommitColor } from '../models/Commit.model';

@Component({
  selector: 'app-questions-completion-view',
  templateUrl: './questions-completion-view.component.html',
  styleUrls: ['./questions-completion-view.component.scss']
})
export class QuestionsCompletionViewComponent implements OnInit {
  today: Date;
  dict = {};
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
        title(tooltipItem, data) {
          return data.datasets[tooltipItem[0].datasetIndex].label;
        },
        beforeBody(tooltipItem, data) {
          return 'Students :';
        },
        label(tooltipItem, data) {
          return '';
        },
        afterBody(tooltipItem, data) {
          console.log(tooltipItem, data);
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
            labelString: '# of commits'
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

  chartData = [];

  constructor(private dataService: DataService) {}

  ngOnInit() {
    Chart.pluginService.register(ChartDataLabels);
    this.today = this.dataService.lastUpdateDate;
    this.initDict();
    this.loadQuestions();
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
    this.dataService.repositories.forEach(repository => {
      repository.commits.forEach(commit => {
        if (commit.question) {
          this.dict[commit.question][commit.color.label].nb++;
          this.dict[commit.question][commit.color.label].students.push(
            repository.name
          );
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

    this.chartData.push({
      label: 'Before review',
      backgroundColor: CommitColor.BEFORE.color, // green
      borderColor: 'grey',
      data: this.chartLabels.map(label => {
        return {
          y:
            (this.dict[label][CommitColor.BEFORE.label].nb /
              this.dataService.repositories.length) *
            100,
          data: this.dict[label][CommitColor.BEFORE.label]
        };
      })
    });

    this.chartData.push({
      label: 'Between review and correction',
      backgroundColor: CommitColor.BETWEEN.color, // orange
      borderColor: 'grey',
      data: this.chartLabels.map(label => {
        return {
          y:
            (this.dict[label][CommitColor.BETWEEN.label].nb /
              this.dataService.repositories.length) *
            100,
          data: this.dict[label][CommitColor.BETWEEN.label]
        };
      })
    });

    this.chartData.push({
      label: 'After correction',
      backgroundColor: CommitColor.AFTER.color, // red
      borderColor: 'grey',
      data: this.chartLabels.map(label => {
        return {
          y:
            (this.dict[label][CommitColor.AFTER.label].nb /
              this.dataService.repositories.length) *
            100,
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

    this.chartData.push({
      label: 'Not finished',
      backgroundColor: 'grey', // grey
      borderColor: 'grey',
      data: this.chartLabels.map(label => {
        return {
          y:
            (this.dict[label]['NoCommit'].nb /
              this.dataService.repositories.length) *
            100,
          data: this.dict[label]['NoCommit']
        };
      })
    });

    // console.log(this.chartData);
  }
}
