import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Chart } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { AuthService } from '../services/auth.service';
import * as firebase from 'firebase/app';

@Component({
  selector: 'app-graph-view',
  templateUrl: './graph-view.component.html',
  styleUrls: ['./graph-view.component.scss']
})
export class GraphViewComponent implements OnInit {

  constructor(private authService: AuthService) { }

  commit = null;
  data = 'salut';
  monImage = new Image();
  @ViewChild('chart') chartComponent: BaseChartDirective;

  chartOptions = {
    responsive: true,
    legend: false,
    hover: {
      mode: 'nearest',
      intersec: true,
    },
    interaction: {
      mode: 'nearest',
    },
  };

  chartData = [
    { data: [{x: 'January', y: 370,
      myobject: 'https://gitlab.com/jeroli.co/git-supervisor/commit/6790c6a2f9538aed739921c3b6741f9023961e02'},
      600, 260, 700, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000], label: 'Account A', pointStyle: this.monImage },
    { data: [120, 455, 100, 340, 300, 350, 400, 450, 500, 1950, 600, 650, 700, 750, 800, 850, 900, 950, 1000], label: 'Account B' },
    { data: [45, 67, 800, 500, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000], label: 'Account C' }
  ];

  chartLabels = ['January', 'February', 'Mars', 'April', 'fgrfg', 'lkbnr', 'vkner', 'bkjner', 'ekbjne', 'bnj fdb', 'oijebe', 'blknkrtb', 'zahuvchaebv', 'vmr,gkjer', 'zvhzjevbzk', 'kzjbdvhjbze', 'kgjvbekjbver', 'lj,ntyl', 'njbevjhbze'];

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
    if (event.active.length > 0) {
      const dataIndex = event.active[0]._index;
      const mois = this.chartLabels[dataIndex];

      this.commit = {message: '[' + mois + '] Checkstyle of api client crossref & isbn2ppn + add reporting pom',
                     author: 'jeremieguy1',
                     date: '2017-04-01T15:29:16Z'};
    } else {
      this.commit = null;
    }
  }

  ngOnInit(): void {
    this.monImage.src = 'https://i.imgur.com/DIbr9q1.png';
    console.log('token : ', this.authService.token);
  }

}
