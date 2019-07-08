import { Component, OnInit } from '@angular/core';
import * as Chart from 'chart.js';
import * as ChartDataLabels from 'chartjs-plugin-datalabels';
import { DataService } from '../services/data.service';
import { Repository } from '../models/Repository.model';
import { CommitColor, Commit } from '../models/Commit.model';

@Component({
  selector: 'app-students-commits-view',
  templateUrl: './students-commits-view.component.html',
  styleUrls: ['./students-commits-view.component.scss']
})
export class StudentsCommitsViewComponent implements OnInit {
  today: Date;
  dict = [];
  tpGroup: string;
  chartLabels = [];
  chartOptions = {
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
      enabled: true,
      mode: 'index'
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
          scaleLabel: {
            display: true,
            labelString: 'Question progression'
          },
          labels: this.dataService.questions
            ? this.dataService.questions.slice().reverse()
            : []
        },
        {
          id: 'C',
          stacked: true,
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
        clamp: true,
        clip: true,
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

  constructor(private dataService: DataService) {}

  loadGraphDataAndRefresh() {
    if (this.dataService.repositories) {
      // this.initDict();
      this.dict = [];
      this.loadDict();
      console.log(this.dict);
      // console.log(this.chartData);
    }
  }

  ngOnInit() {
    Chart.pluginService.register(ChartDataLabels);
    this.today = this.dataService.lastUpdateDate;
    this.loadGraphDataAndRefresh();
  }

  loadDict() {
    this.chartLabels = [];
    let repos = this.dataService.repositories.filter(
      repository => !this.tpGroup || repository.tpGroup === this.tpGroup
    );
    repos.forEach((repository, index) => {
      this.initDict(repository);
      this.chartLabels.push(repository.name);
      repository.commits.forEach(commit => {
        this.dict[index][commit.color.label].nb++;
        this.dict[index].nbTotal++;
        this.isSupThan(commit.question, this.dict[index].question) &&
          (this.dict[index].question = commit.question);
      });
    });

    let data = [];

    data.push({
      label: '# of commits',
      yAxisID: 'C',
      type: 'line',
      fill: false,
      borderWidth: 2,
      datalabels: {
        display: true
      },
      borderColor: 'lightblue', // light blue
      hoverBackgroundColor: 'lightblue',
      backgroundColor: 'lightblue',
      data: this.dict.map(student => {
        return {
          y: student.nbTotal,
          data: student
        };
      })
    });

    data.push({
      label: 'Question progression',
      borderColor: 'blue',
      type: 'line',
      fill: false,
      datalabels: {
        display: true
      },
      yAxisID: 'B',
      data: this.dict.map(student => {
        return {
          y: student.question,
          data: student
        };
      })
    });

    data.push({
      label: 'Intermediate commit',
      backgroundColor: CommitColor.INTERMEDIATE.color,
      hoverBackgroundColor: CommitColor.INTERMEDIATE.color,
      borderColor: 'grey',
      yAxisID: 'A',
      data: this.dict.map(student => {
        return {
          y:
            (student[CommitColor.INTERMEDIATE.label].nb / student.nbTotal) *
            100,
          data: student
        };
      })
    });
    data.push({
      label: 'Before review',
      yAxisID: 'A',
      backgroundColor: CommitColor.BEFORE.color,
      hoverBackgroundColor: CommitColor.BEFORE.color,
      borderColor: 'grey',
      data: this.dict.map(student => {
        return {
          y: (student[CommitColor.BEFORE.label].nb / student.nbTotal) * 100,
          data: student
        };
      })
    });
    data.push({
      label: 'Between review and correction',
      yAxisID: 'A',
      backgroundColor: CommitColor.BETWEEN.color,
      hoverBackgroundColor: CommitColor.BETWEEN.color,
      borderColor: 'grey',
      data: this.dict.map(student => {
        return {
          y: (student[CommitColor.BETWEEN.label].nb / student.nbTotal) * 100,
          data: student
        };
      })
    });
    data.push({
      label: 'After correction',
      yAxisID: 'A',
      backgroundColor: CommitColor.AFTER.color,
      hoverBackgroundColor: CommitColor.AFTER.color,
      borderColor: 'grey',
      data: this.dict.map(student => {
        return {
          y: (student[CommitColor.AFTER.label].nb / student.nbTotal) * 100,
          data: student
        };
      })
    });

    this.chartData = data;
  }

  initDict(repository: Repository) {
    this.dict.push({});
    for (let color in CommitColor) {
      this.dict[this.dict.length - 1][CommitColor[color].label] = {};
      this.dict[this.dict.length - 1][CommitColor[color].label].nb = 0;
    }
    this.dict[this.dict.length - 1].question = this.dataService.questions[0];
    this.dict[this.dict.length - 1].nbTotal = 0;
  }

  compareQuestions(q1, q2) {
    let questions = this.dataService.questions;
    return questions.indexOf(q1) - questions.indexOf(q2);
  }

  isSupThan(q1, q2) {
    return (
      this.dataService.questions.includes(q2) &&
      this.compareQuestions(q1, q2) > 0
    );
  }

  // initDict() {
  //   this.dataService.questions.forEach(question => {
  //     this.dict[question] = {};
  //     [
  //       CommitColor.BEFORE.label,
  //       CommitColor.BETWEEN.label,
  //       CommitColor.AFTER.label,
  //       'NoCommit'
  //     ].forEach(color => {
  //       this.dict[question][color] = {
  //         nb: 0,
  //         students: []
  //       };
  //     });
  //   });
  // }
}
