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
      600, 260, 700], label: 'Account A', pointStyle: this.monImage },
    { data: [120, 455, 100, 340], label: 'Account B' },
    { data: [45, 67, 800, 500], label: 'Account C' }
  ];

  chartLabels = ['January', 'February', 'Mars', 'April'];

  onChartClick(event) {
    console.log(event);
    if (event.active.length > 0) {
      const datasetIndex = event.active[0]._datasetIndex;
      const dataIndex = event.active[0]._index;
      const dataObject = this.chartData[datasetIndex].data[dataIndex];
      console.log(dataObject);
// tslint:disable-next-line: no-string-literal
      window.open(dataObject['myobject'], '_blank');
    }
  }

  onChartHover(event) {
    // console.log(event);
  }

  ngOnInit(): void {
    this.monImage.src = 'https://i.imgur.com/DIbr9q1.png';
    console.log('token : ', this.authService.token);
  }

}
