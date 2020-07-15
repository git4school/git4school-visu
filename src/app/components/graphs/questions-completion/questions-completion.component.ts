import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { Component, OnInit, ViewChild } from '@angular/core';
import { DataProvidedGuard } from '@guards/data-provided.guard';
import { CommitColor } from '@models/Commit.model';
import { TranslateService } from '@ngx-translate/core';
import { CommitsService } from '@services/commits.service';
import { DataService } from '@services/data.service';
import { LoaderService } from '@services/loader.service';
import { BaseChartDirective } from 'ng2-charts';
import { BaseGraphComponent } from '../base-graph.component';


registerLocaleData(localeFr);

/**
 * jquery
 */
declare var $: any;

/**
 * This component displays a graph with the questions completion
 */
@Component({
  selector: 'questions-completion',
  templateUrl: './questions-completion.component.html',
  styleUrls: ['./questions-completion.component.scss']
})
export class QuestionsCompletionComponent extends BaseGraphComponent implements OnInit {
  /**
   * The chart object from the DOM
   */
  @ViewChild(BaseChartDirective, { static: true }) myChart;

  /**
   * The date after which the commits will not be considered, this shows the progression of the tp group on a given date
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
   * The data about questions
   */
  dict = {};

  /**
   * The filter on the tp group of repositories
   */
  tpGroup: string;

  /**
   * The graph labels, which corresponds to the questions
   */
  chartLabels;

  /**
   * The options for chart js
   */
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
          return (
            data.datasets[tooltipItem[0].datasetIndex].data[
              tooltipItem[0].index
            ].translations['QUESTION'] +
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
            ].data.count +
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
          gridLines: this.getGridLines()
        }
      ]
    },
    plugins: {
      datalabels: {
        clamp: true,
        clip: 'auto',
        color: 'white',
        display: function (context) {
          return context.dataset.data[context.dataIndex].y > 3;
        },
        font: {
          weight: 'bold'
        },
        backgroundColor: function (context) {
          return context.dataset.backgroundColor;
        },
        borderRadius: 4,
        formatter: function (value, context) {
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

  /**
   * The data for chart js
   */
  chartData = [{ data: [] }];

  /**
   * QuestionsCompletionComponent constructor
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
   * Updates dict variable with questions data and loads graph labels which displays data on the graph
   */
  loadGraphDataAndRefresh() {
    if (this.dataProvided.dataLoaded()) {
      let translations = this.translateService
        .instant(['QUESTION', 'COMMITS-COUNT', 'COMMITS-PERCENTAGE']);
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
        this.dataService.questions,
        translations
      );
    }
  }

  /**
   * Updates the bar index in the chart options with the current bar index from dataService
   */
  updateBar() {
    this.chartOptions.scales.yAxes[0].gridLines = this.getGridLines();
  }

  getGridLines(): any {
    let index = 10 - this.dataService.barIndex;
    let lineWidth = new Array(11).fill(1);
    let color = new Array(11).fill('rgba(0, 0, 0, 0.1)');

    lineWidth[index] = 5;
    color[index] = CommitColor.AFTER.color;

    return {
      lineWidth: lineWidth,
      color: color,
      zeroLineWidth: 0
    };
  }

  /**
   * Updates bar index and refreshes the graph
   */
  changeBarIndex() {
    this.updateBar();
    this.myChart.chart.update();
    this.myChart.chart.destroy();
    this.myChart.ngOnInit();
  }

  /**
   * When the component is initialized, we initialize date, max and min
   * and we call loadGraphDataAndRefresh()
   */
  ngOnInit() {
    setTimeout(() => {
      this.translateService.onLangChange.subscribe(() => {
        this.loadGraphDataAndRefresh();
      });
      if (this.dataService.repoToLoad) {
        this.loadGraph(this.dataService.startDate, this.dataService.endDate);
      } else {
        this.loading = true;
        this.initDateSlider();
        this.loadGraphMetadata(this.dataService.repositories, this.dataService.reviews, this.dataService.corrections, this.dataService.questions);
        this.loading = false;
      }
    });
  }


  loadGraph(startDate?: string, endDate?: string) {
    this.loading = true;
    this.loaderService.loadRepositories(startDate, endDate).subscribe(() => {
      this.initDateSlider();
      this.loadGraphMetadata(this.dataService.repositories, this.dataService.reviews, this.dataService.corrections, this.dataService.questions);
      this.loading = false;
    });
  }

  initDateSlider() {
    this.dataService.lastUpdateDate &&
      ((this.date = this.dataService.lastUpdateDate.getTime()) &&
        (this.max = this.date) &&
        (this.min = this.getMinDateTimestamp()));
  }

  /**
   * Returns the minimum date needed by the date slider
   * @returns A timestamp corresponding to the minimum date selectable with the date slider
   */
  getMinDateTimestamp() {
    let commits = [];
    this.dataService.repositories.filter(repo => repo.commits).forEach(repository => {
      // commits = commits.concat(repository.commits);
      Array.prototype.push.apply(commits, repository.commits);
    });
    if (!commits.length) return new Date();
    let min = commits.reduce(
      (min, commit) =>
        commit.commitDate.getTime() < min.getTime() ? commit.commitDate : min,
      commits[0].commitDate
    );
    return min.getTime();
  }
}
