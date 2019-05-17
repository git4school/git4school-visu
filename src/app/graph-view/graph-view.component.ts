import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { AuthService } from '../services/auth.service';
import { CommitsService } from '../services/commits.service';
import { Commit } from '../models/Commit.model';


@Component({
  selector: 'app-graph-view',
  templateUrl: './graph-view.component.html',
  styleUrls: ['./graph-view.component.scss']
})
export class GraphViewComponent implements OnInit {

  constructor(private authService: AuthService, private commitsService: CommitsService) { }

  @ViewChild(BaseChartDirective) myChart: BaseChartDirective;

  commits: Commit[][] = [];
  commit = null;
  monImage = new Image();
  public repositories: string[];
  public filename;

  chartOptions = {
    responsive: true,
    aspectRatio: 2.4,
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
          return '';
        },
        beforeBody(tooltipItem, data) {
          const commit = data.datasets[tooltipItem[0].datasetIndex].data[tooltipItem[0].index].commit;
          return commit.message + '\n\n' + commit.author;
        }
      },
      displayColors: false
    },
    elements: {
      line: {
        fill: false,
        borderWidth: 1
      },
      point: {
        hitRadius: 8,
        radius: 5,
        pointStyle: 'circle'
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
                day: 'DD/MM/YY',
                week: 'MMM DD',
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
          speed: 0.3,
          onZoom: ({chart}) => {  }
        }
      }
    }
  };

  chartData = [
    {data: []}
  ];

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

  onChartHover(event) { }

  ngOnInit(): void {
    // this.loadGraph();
  }

  loadGraph() {
    this.monImage.src = 'https://image.flaticon.com/icons/png/512/25/25694.png';
    this.monImage.height = 15;
    this.monImage.width = 15;

    console.log(this.repositories);

    this.commitsService.getRepositoriesCommits(this.repositories).subscribe(response => {
      const chartData = [];
      for (let i = 0; i < response.length; i++) {
        this.commits.push(response[i].slice());
        const data = [];
        this.commits[i].forEach(commit => {
          data.push({x: commit.commitDate, y: 150 + i, commit});
        });
        chartData.push({data});
      }
      this.chartData = chartData;
      console.log(this.chartData);
    });
  }

  changeListener($event): void {
    this.readFile($event.target);
  }

  readFile(inputValue: any): void {
      const file: File = inputValue.files[0];
      const myReader: FileReader = new FileReader();
      const fileType = inputValue.parentElement.id;
      myReader.onloadend = (e) => {
        this.filename = file.name;
        const text = this.getJSONOrNull(myReader.result);
        if (text) {
          this.repositories = text.repositories.slice();
        }
        this.loadGraph();
     };

      myReader.readAsText(file);
  }

  getJSONOrNull(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  }
}
