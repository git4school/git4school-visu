import { Component, OnInit } from '@angular/core';
import * as Chart from 'chart.js';
import * as ChartDataLabels from 'chartjs-plugin-datalabels';

@Component({
  selector: 'app-questions-completion-view',
  templateUrl: './questions-completion-view.component.html',
  styleUrls: ['./questions-completion-view.component.scss']
})
export class QuestionsCompletionViewComponent implements OnInit {
  chartLabels = ['1', '2.1', '2.1', '3'];
  chartOptions = {
    responsive: true,
    aspectRatio: 2.4,
    legend: {
      position: 'bottom'
    },
    tooltips: {
      mode: 'index'
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
          return context.dataset.data[context.dataIndex] > 3;
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
      label: 'Before review',
      backgroundColor: 'rgb(53, 198, 146)', // green
      borderColor: 'grey',
      data: [50, 40, 38, 18]
    },
    {
      label: 'Between review and correction',
      backgroundColor: 'rgb(255, 127, 74)', // orange
      borderColor: 'grey',
      data: [25, 30, 19, 0]
    },
    {
      label: 'After correction',
      backgroundColor: 'rgb(203, 91, 68)', // red
      borderColor: 'grey',
      data: [17, 15, 0, 0]
    }
  ];

  constructor() {}

  ngOnInit() {
    Chart.pluginService.register(ChartDataLabels);
  }
}
