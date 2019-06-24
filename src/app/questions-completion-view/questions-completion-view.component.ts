import { Component, OnInit } from '@angular/core';

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
    }
  };

  chartData = [
    {
      label: 'Before review',
      backgroundColor: 'green',
      borderColor: 'grey',
      data: [50, 40, 38, 18]
    },
    {
      label: 'Between review and correction',
      backgroundColor: 'orange',
      borderColor: 'grey',
      data: [25, 30, 19, 0]
    },
    {
      label: 'After correction',
      backgroundColor: 'red',
      borderColor: 'grey',
      data: [17, 15, 0, 0]
    }
  ];

  constructor() {}

  ngOnInit() {}
}
