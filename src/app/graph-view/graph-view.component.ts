import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { AuthService } from '../services/auth.service';
import { CommitsService } from '../services/commits.service';
import { Commit } from '../models/Commit.model';
import { ToastrService } from 'ngx-toastr';
import { validateConfig } from '@angular/router/src/config';
import { Repository } from '../models/Repository.model';
import moment from 'moment/src/moment';


@Component({
  selector: 'app-graph-view',
  templateUrl: './graph-view.component.html',
  styleUrls: ['./graph-view.component.scss']
})
export class GraphViewComponent implements OnInit {

  constructor(private authService: AuthService, private commitsService: CommitsService, private toastr: ToastrService) { }

  @ViewChild(BaseChartDirective) myChart: BaseChartDirective;

  loading = false;
  commits: Commit[][] = [];
  commit = null;
  monImage = new Image();
  public repositories: string[];
  public filename;
  unit = 'day';
  target = null;
  corrections;
  seances;
  reviews;

  chartOptions = {
    responsive: true,
    aspectRatio: 2.4,
    animation: {
      duration: 0 // general animation time
    },
    responsiveAnimationDuration: 0,
    hover: {
      mode: 'nearest',
      intersec: true,
      animationDuration: 0
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
    scales: {
      xAxes: [{
        type: 'time',
        offset: true,
        time: {
          unit: this.unit,
          tooltipFormat: 'DD/MM/YY HH:mm',
          displayFormats: {
            day: 'DD/MM/YY',
            week: 'DD/MM/YY',
          }
        }
      }],
      yAxes: [{
        type: 'category',
        labels: [],
        offset: true,
      }]
    },
    annotation: {
      drawTime: 'beforeDatasetsDraw',
      annotations: []
    },
    plugins: {
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
          onPan({chart}) { }
        },
        zoom: {
          enabled: true,
          mode: 'x',
          speed: 0.3,
          onZoom: ({chart}) => { }
        }
      },
    }
  };

  chartData = [
    {data: []}
  ];

  changeUnit() {
    if (this.chartOptions.scales.xAxes[0].time.unit === 'week') {
      this.chartOptions.scales.xAxes[0].time.unit = 'day';
    } else {
      this.chartOptions.scales.xAxes[0].time.unit = 'week';
    }
    this.refreshGraph();
  }

  onChartClick(event) {
    if (event.active.length > 0) {
      const data = this.getDataFromChart(event);
      // tslint:disable-next-line: no-string-literal
      console.log(data);
      window.open(data.commit.url, '_blank');
    }
  }

  getDataFromChart(event) {
    const datasetIndex = event.active[0]._datasetIndex;
    const dataIndex = event.active[0]._index;
    return this.chartData[datasetIndex].data[dataIndex];
  }

  onChartHover(event) { }

  ngOnInit(): void { }

  loadGraph(date?: Date) {
    this.loading = true;
    this.monImage.src = 'https://image.flaticon.com/icons/png/512/25/25694.png';
    this.monImage.height = 15;
    this.monImage.width = 15;

    this.commitsService.getRepositories(this.repositories, date).subscribe(response => {
      const chartData = [];
      const labels = [];
      this.chartOptions.annotation.annotations = [];

      if (this.corrections) {
        this.corrections.forEach(correction => {
          this.chartOptions.annotation.annotations.push(
            {
              type: 'line',
              mode: 'vertical',
              scaleID: 'x-axis-0',
              value: moment(correction.date, 'DD/MM/YYYY HH:mm').toDate(),
              borderColor: 'red',
              borderWidth: 1,
              label: {
                content: correction.label,
                enabled: true,
                position: 'top',
              }
            }
          );
        });
      }

      if (this.seances) {
        this.seances.forEach(seance => {
          this.chartOptions.annotation.annotations.push(
            {
              type: 'box',
              xScaleID: 'x-axis-0',
              yScaleID: 'y-axis-0',
              xMin: moment(seance.dateDebut, 'DD/MM/YYYY HH:mm').toDate(),
              xMax: moment(seance.dateFin, 'DD/MM/YYYY HH:mm').toDate(),
              borderColor: 'white',
              borderWidth: 2,
              backgroundColor: 'darkTurquoise'
            }
          );
        });
      }

      if (this.reviews) {
        this.reviews.forEach(review => {
          this.chartOptions.annotation.annotations.push(
            {
              type: 'line',
              mode: 'vertical',
              scaleID: 'x-axis-0',
              value: moment(review.date, 'DD/MM/YYYY HH:mm').toDate(),
              borderColor: 'blue',
              borderWidth: 1,
              label: {
                content: review.label,
                enabled: true,
                position: 'top'
              }
            }
          );
        });
      }

      for (let i = 0; i < response.length; i++) {
        this.commits.push(response[i].commits.slice());
        const data = [];
        labels.push(response[i].name);
        this.commits[i].forEach(commit => {
          data.push({x: commit.commitDate, y: response[i].name, commit});
        });
        chartData.push({data});
      }
      this.chartData = chartData;
      this.chartOptions.scales.yAxes[0].labels = labels;
      this.refreshGraph();
      this.loading = false;
    },
    error => {
      console.log('ERROR', error);
      this.error('Erreur Git', 'Un des dépôts Github n\'existe pas ou vous n\'avez pas les droits dessus.');
      this.loading = false;
    });
  }

  refreshGraph() {
    this.myChart.chart.destroy();
    this.myChart.ngOnInit();
  }

  changeListener($event): void {
    this.target = $event.target;
    this.readFile();
  }

  error(titre, message) {
    this.toastr.error(message, titre, {
      progressBar: true
    });
  }

  warning(titre, message) {
    this.toastr.warning(message, titre, {
      progressBar: true
    });
  }

  readFile(): void {
    const inputValue = this.target;
    const file: File = inputValue.files[0];
    const myReader: FileReader = new FileReader();
    const fileType = inputValue.parentElement.id;
    myReader.onloadend = (e) => {
      this.filename = file.name;
      const text = this.getJSONOrNull(myReader.result);
      if (text) {
        this.repositories = this.extractRepositories(text.repositories.slice());
        if (text.repositories.length !== this.repositories.length) {
          this.warning('Attention', 'Une ou plusieurs URL ne sont pas bien formatées !');
        }
        this.corrections = text.corrections;
        this.seances = text.seances;
        this.reviews = text.reviews;
        if (text.date) {
          this.loadGraph(moment(text.date, 'DD/MM/YYYY HH:mm').toDate());
        } else {
          this.loadGraph();
        }
      } else {
        this.error('Erreur', 'Le fichier n\'est pas un fichier JSON valide.');
      }
    };

    myReader.readAsText(file);
  }

  verifyJSON() {
    // TODO: Envoyer des alertes (warning et error), renvoie false s'il y a une erreur, true s'il y a seulement warning ou rien
  }

  extractRepositories(repositories) {
    const tab = [];
    repositories.forEach(repository => {
      if (repository.match(/https:\/\/github.com\/[^\/]*\/[^\/]*/)) {
        tab.push(repository);
      }
    });
    return tab;
  }

  getJSONOrNull(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  }
}
