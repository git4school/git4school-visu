import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-students-commits-view',
  templateUrl: './students-commits-view.component.html',
  styleUrls: ['./students-commits-view.component.scss']
})
export class StudentsCommitsViewComponent implements OnInit {
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
    }
  };

  chartData = [
    {
      label: '# of commits',
      yAxisID: 'B',
      type: 'line',
      fill: false,
      borderWidth: 2,
      borderColor: 'lightblue',
      data: [25, 21, 45, 22]
    },
    {
      label: 'Intermediate commit',
      yAxisID: 'A',
      type: 'bar',
      backgroundColor: 'black',
      borderColor: 'grey',
      data: [10, 3, 25, 1]
    },
    {
      label: 'Before review',
      yAxisID: 'A',
      type: 'bar',
      backgroundColor: 'green',
      borderColor: 'grey',
      data: [50, 20, 15, 80]
    },
    {
      label: 'Between review and correction',
      yAxisID: 'A',
      type: 'bar',
      backgroundColor: 'orange',
      borderColor: 'grey',
      data: [30, 20, 35, 19]
    },
    {
      label: 'After correction',
      yAxisID: 'A',
      type: 'bar',
      backgroundColor: 'red',
      borderColor: 'grey',
      data: [10, 57, 25, 0]
    }
  ];

  constructor() {}

  ngOnInit() {}
}
