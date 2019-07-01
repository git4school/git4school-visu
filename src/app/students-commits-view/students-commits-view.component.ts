import { Component, OnInit } from '@angular/core';
import * as Chart from 'chart.js';
import * as ChartDataLabels from 'chartjs-plugin-datalabels';
import { DataService } from '../services/data.service';

@Component({
  selector: 'app-students-commits-view',
  templateUrl: './students-commits-view.component.html',
  styleUrls: ['./students-commits-view.component.scss']
})
export class StudentsCommitsViewComponent implements OnInit {
  today: Date;
  chartLabels = ['Sam Soule', 'Sophie Stiqué', 'Otto Mobil', 'Emma Caréna'];
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
          offset: true,
          stacked: true
        }
      ],
      yAxes: [
        {
          id: 'A',
          type: 'linear',
          offset: true,
          position: 'left',
          stacked: true,
          scaleLabel: {
            display: true,
            labelString: '% of commits'
          }
        },
        {
          id: 'B',
          offset: true,
          type: 'linear',
          position: 'right',
          scaleLabel: {
            display: true,
            labelString: '# of commits'
          }
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
        display: function(context) {
          return context.dataset.data[context.dataIndex] >= 5;
        },
        font: {
          weight: 'bold'
        },
        backgroundColor: function(context) {
          return context.dataset.backgroundColor;
        },
        borderRadius: 4
      }
    }
  };

  chartData = [
    {
      label: '# of commits',
      yAxisID: 'B',
      type: 'line',
      fill: false,
      borderWidth: 2,
      borderColor: 'rgb(194, 224, 249)', // light blue
      backgroundColor: 'rgb(176, 45, 116)', // purple
      data: [25, 21, 45, 22]
    },
    {
      label: 'Intermediate commit',
      yAxisID: 'A',
      type: 'bar',
      backgroundColor: 'rgb(77, 77, 77)', // black
      borderColor: 'grey',
      data: [10, 3, 25, 1]
    },
    {
      label: 'Before review',
      yAxisID: 'A',
      type: 'bar',
      backgroundColor: 'rgb(53, 198, 146)', // green
      borderColor: 'grey',
      data: [50, 20, 15, 80]
    },
    {
      label: 'Between review and correction',
      yAxisID: 'A',
      type: 'bar',
      backgroundColor: 'rgb(255, 127, 74)', // orange
      borderColor: 'grey',
      data: [30, 20, 35, 19]
    },
    {
      label: 'After correction',
      yAxisID: 'A',
      type: 'bar',
      backgroundColor: 'rgb(203, 91, 68)', // red
      borderColor: 'grey',
      data: [10, 57, 25, 0]
    }
  ];

  constructor(private dataService: DataService) {}

  ngOnInit() {
    Chart.pluginService.register(ChartDataLabels);
    this.today = this.dataService.lastUpdateDate;
  }
}
