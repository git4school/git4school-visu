import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Chart } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { AuthService } from '../services/auth.service';
import * as firebase from 'firebase/app';
import * as ChartZoom from 'chartjs-plugin-zoom';
import { CommitsService } from '../services/commits.service';
import { Commit } from '../models/Commit.model';
import { faHome } from '@fortawesome/free-solid-svg-icons';


@Component({
  selector: 'app-graph-view',
  templateUrl: './graph-view.component.html',
  styleUrls: ['./graph-view.component.scss']
})
export class GraphViewComponent implements OnInit {

  constructor(private authService: AuthService, private commitsService: CommitsService) { }

  @ViewChild(BaseChartDirective) myChart: BaseChartDirective;

  commits: Commit[];
  commit = null;
  data = 'salut';
  monImage = new Image();

  chartOptions = {
    responsive: true,
    aspectRatio: 2.2,
    hover: {
      mode: 'nearest',
      intersec: true,
    },
    interaction: {
      mode: 'nearest',
    },
    tooltips: {
      callbacks: {
        label(tooltipItem, data) {
          return 'fzfze \n fzefez';
        },
        beforeBody(tooltipItem, data) {
          return 'kjgerbn \n fsdf';
        }
      }
    },
    elements: {
      line: {
        fill: false,
        borderWidth: 1
      },
      point: {
        hitRadius: 8,
        radius: 5,
        pointStyle: this.monImage
      }
    },
    // showLines: false,
    scales: {
      xAxes: [{
          type: 'time',
          time: {
              unit: 'day',
              tooltipFormat: 'DD/MM/YY HH:mm',
              displayFormats: {
                day: 'DD/MM/YY HH:mm'
              }
          }
      }]
    },
    plugins: {
      zoom: {
        pan: {
          enabled: true,
          mode: 'xy',
          onPan({chart}) { console.log(`I was panned!!!`); }
        },
        zoom: {
          enabled: true,
          // drag: true,
          // drag: {
          //   borderColor: 'rgba(225,225,225,0.3)',
          //   borderWidth: 5,
          //   backgroundColor: 'rgb(225,225,225)'
          // },

          mode: 'xy',

          // Speed of zoom via mouse wheel
          // (percentage of zoom on a wheel event)
          speed: 0.1,
          onZoom: ({chart}) => {  }
        }
      }
    }
  };

  chartData = [
    {
      data: [
        // {x: new Date('2017-04-01T15:29:16Z'), y: 150},
        // {x: new Date('2017-04-04T15:29:16Z'), y: 150},
        // {x: new Date('2017-04-05T15:29:16Z'), y: 150},
        // {x: new Date('2017-04-08T15:29:16Z'), y: 150},
        // {x: new Date('2017-04-10T15:29:16Z'), y: 150},
        // {x: new Date('2017-04-12T15:29:16Z'), y: 150},
        // {x: new Date('2017-04-17T15:29:16Z'), y: 150},
        // {x: new Date('2017-04-17T16:29:16Z'), y: 150},
        // {x: new Date('2017-04-18T15:29:16Z'), y: 150},
        // {x: new Date('2017-04-20T15:29:16Z'), y: 150},
        // {x: new Date('2017-04-22T15:29:16Z'), y: 150}
      ],
      // pointStyle: ['circle', 'cross', 'crossRot', 'dash', this.monImage, 'line', 'rect', 'rectRounded', 'rectRot', 'star', 'triangle']
    }
    // { data: [{x: 'January', y: 370,
    //   myobject: 'https://gitlab.com/jeroli.co/git-supervisor/commit/6790c6a2f9538aed739921c3b6741f9023961e02'},
    //   600, 260, 700, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000], label: 'Account A', pointStyle: this.monImage },
    // { data: [120, 455, 100, 340, 300, 350, 400, 450, 500, 1950, 600, 650, 700, 750, 800, 850, 900, 950, 1000], label: 'Account B' },
    // { data: [45, 67, 800, 500, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000], label: 'Account C' }
  ];

  // chartLabels = ['January', 'February', 'Mars', 'April', 'fgrfg', 'lkbnr', 'vkner', 'bkjner', 'ekbjne', 'bnj fdb', 'oijebe', 'blknkrtb', 'zahuvchaebv', 'vmr,gkjer', 'zvhzjevbzk', 'kzjbdvhjbze', 'kgjvbekjbver', 'lj,ntyl', 'njbevjhbze'];

  onChartClick(event) {
    console.log(event);
    if (event.active.length > 0) {
      const dataObject = this.getDataFromChart(event);
      console.log(dataObject);
// tslint:disable-next-line: no-string-literal
      window.open(dataObject['myobject'], '_blank');
    }
  }

  getDataFromChart(event) {
    const datasetIndex = event.active[0]._datasetIndex;
    const dataIndex = event.active[0]._index;
    return this.chartData[datasetIndex].data[dataIndex];
  }

  onChartHover(event) {
    // if (event.active.length > 0) {
    //   const dataIndex = event.active[0]._index;
    //   const mois = this.chartLabels[dataIndex];

    //   this.commit = {message: '[' + mois + '] Checkstyle of api client crossref & isbn2ppn + add reporting pom',
    //                  author: 'jeremieguy1',
    //                  date: '2017-04-01T15:29:16Z'};
    // } else {
    //   this.commit = null;
    // }
  }

  ngOnInit(): void {
    this.monImage.src = 'https://i.imgur.com/DIbr9q1.png';
    this.monImage.height = 10;
    this.commitsService.getCommits().subscribe(response => {
      this.commits = response.slice();
      console.log(this.commits);
      this.commits.forEach(commit => {
        this.chartData[0].data.push({x: commit.commitDate, y: 150, commit});
      });
    });
  }

}
