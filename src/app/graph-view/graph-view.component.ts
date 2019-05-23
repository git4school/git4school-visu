import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { AuthService } from '../services/auth.service';
import { CommitsService } from '../services/commits.service';
import { Commit } from '../models/Commit.model';
import { ToastrService } from 'ngx-toastr';
import { validateConfig } from '@angular/router/src/config';
import { Repository } from '../models/Repository.model';
import { Seance } from '../models/Seance.model';
import { Jalon } from '../models/Jalon.model';

@Component({
  selector: 'app-graph-view',
  templateUrl: './graph-view.component.html',
  styleUrls: ['./graph-view.component.scss']
})
export class GraphViewComponent implements OnInit {
  constructor(
    private authService: AuthService,
    private commitsService: CommitsService,
    private toastr: ToastrService
  ) {}

  @ViewChild(BaseChartDirective) myChart: BaseChartDirective;

  loading = false;
  public repositoriesURL: string[];
  unit = 'day';
  file = null;
  filename: string;
  corrections: Jalon[];
  seances: Seance[];
  reviews: Jalon[];
  repositories: Repository[];
  chartData = [{ data: [] }];

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
      mode: 'nearest'
    },
    tooltips: {
      callbacks: {
        label(tooltipItem, data) {
          return '';
        },
        beforeBody(tooltipItem, data) {
          const commit =
            data.datasets[tooltipItem[0].datasetIndex].data[
              tooltipItem[0].index
            ].commit;
          return commit.message + '\n\n' + commit.author;
        }
      },
      displayColors: false
    },
    elements: {
      line: {
        fill: false,
        borderWidth: 2,
        lineBackgroundColor: 'rgba(76, 76, 76, 1)',
        borderColor: 'rgba(76, 76, 76, 1)',
        tension: 0
      },
      point: {
        hitRadius: 8
      }
    },
    scales: {
      xAxes: [
        {
          type: 'time',
          time: {
            unit: this.unit,
            tooltipFormat: 'DD/MM/YY HH:mm',
            offset: true,
            displayFormats: {
              day: 'DD/MM/YY',
              week: 'DD/MM/YY'
            }
          }
        }
      ],
      yAxes: [
        {
          type: 'category',
          labels: [],
          offset: true
        }
      ]
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
          onPan({ chart }) {}
        },
        zoom: {
          enabled: true,
          mode: 'x',
          speed: 0.3,
          onZoom: ({ chart }) => {}
        }
      }
    }
  };

  ngOnInit(): void {}

  readFile(): void {
    const myReader: FileReader = new FileReader();
    myReader.onloadend = e => {
      const text = this.getJSONOrNull(myReader.result);
      if (text) {
        this.getDataFromFile(text);
        this.loadGraph(text.date);
      }
    };
    myReader.readAsText(this.file);
  }

  loadGraph(date?: Date) {
    this.loading = true;

    this.commitsService.getRepositories(this.repositoriesURL, date).subscribe(
      repositories => {
        this.repositories = repositories;
        this.loadGraphData();
        this.loading = false;
      },
      error => {
        this.error(
          'Erreur Git',
          "Un des dépôts Github n'existe pas ou vous n'avez pas les droits dessus."
        );
        this.loading = false;
      }
    );
  }

  loadGraphData() {
    this.loadAnnotations();
    this.loadPoints(this.repositories);
    this.refreshGraph();
  }

  loadAnnotations() {
    this.chartOptions.annotation.annotations = [];
    if (this.seances) {
      this.loadSeances();
    }

    if (this.reviews) {
      this.loadReviews();
    }

    if (this.corrections) {
      this.loadCorrections();
    }
  }

  loadSeances() {
    this.seances = this.seances.map(data => Seance.withJSON(data));
    this.seances.forEach(seance => {
      this.chartOptions.annotation.annotations.push({
        type: 'box',
        xScaleID: 'x-axis-0',
        yScaleID: 'y-axis-0',
        xMin: seance.dateDebut,
        xMax: seance.dateFin,
        borderColor: 'rgba(79, 195, 247,1.0)',
        borderWidth: 2,
        backgroundColor: 'rgba(33, 150, 243, 0.15)'
      });
    });
  }

  loadReviews() {
    this.reviews = this.reviews.map(data => Jalon.withJSON(data));
    this.reviews.forEach(review => {
      this.chartOptions.annotation.annotations.push({
        type: 'line',
        mode: 'vertical',
        scaleID: 'x-axis-0',
        value: review.date,
        borderColor: 'blue',
        borderWidth: 1,
        label: {
          content: review.label,
          enabled: true,
          position: 'top'
        }
      });
    });
  }

  loadCorrections() {
    this.corrections = this.corrections.map(data => Jalon.withJSON(data));
    this.corrections.forEach(correction => {
      this.chartOptions.annotation.annotations.push({
        type: 'line',
        mode: 'vertical',
        scaleID: 'x-axis-0',
        value: correction.date,
        borderColor: 'red',
        borderWidth: 1,
        label: {
          content: correction.label,
          enabled: true,
          position: 'top'
        }
      });
    });
  }

  loadPoints(repositories: Repository[]) {
    const chartData = [];
    const labels = [];
    const commits = [];

    for (let i = 0; i < repositories.length; i++) {
      commits.push(repositories[i].commits.slice());
      const data = [];
      const pointStyle = [];
      const radius = [];
      // const pointBackgroundColor = [];
      labels.push(repositories[i].name);
      commits[i].forEach(commit => {
        commit = this.updateCommit(commit);

        data.push({ x: commit.commitDate, y: repositories[i].name, commit });
        pointStyle.push(this.getPointStyle(commit));
        radius.push(commit.isCloture ? 8 : 5);
        // pointBackgroundColor.push('rgba(76, 76, 76, 1)');
      });
      chartData.push({ data, pointStyle, radius /*pointBackgroundColor */ });
    }

    this.chartData = chartData;
    this.chartOptions.scales.yAxes[0].labels = labels;
  }

  updateCommit(commit: Commit) {
    if (this.seances) {
      for (
        let i = 0;
        i < this.seances.length &&
        !commit.updateIsEnSeance(
          this.seances[i].dateDebut,
          this.seances[i].dateFin
        );
        i++
      ) {}
    }
    commit.updateIsCloture(commit.message);
    return commit;
  }

  refreshGraph() {
    this.myChart.chart.destroy();
    this.myChart.ngOnInit();
  }

  changeListener($event): void {
    if ($event.target.files[0]) {
      this.file = $event.target.files[0];
      this.filename = this.file.name;
      this.readFile();
    }
  }

  onChartClick(event) {
    if (event.active.length > 0) {
      const data = this.getDataFromChart(event);
      // tslint:disable-next-line: no-string-literal
      window.open(data.commit.url, '_blank');
    }
  }

  changeUnit() {
    if (this.chartOptions.scales.xAxes[0].time.unit === 'week') {
      this.chartOptions.scales.xAxes[0].time.unit = 'day';
    } else {
      this.chartOptions.scales.xAxes[0].time.unit = 'week';
    }
    this.refreshGraph();
  }

  verifyJSON() {
    // TODO: Envoyer des alertes (warning et error), renvoie false s'il y a une erreur, true s'il y a seulement warning ou rien
  }

  getPointStyle(commit: Commit) {
    let image = new Image(12, 12);

    if (commit.isCloture) {
      image.height = 20;
      image.width = 20;
    }
    if (commit.isEnSeance) {
      image.src = './assets/fac.png';
    } else {
      image.src = './assets/maison.png';
    }

    return image;
  }

  getJSONOrNull(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      this.error("Le fichier n'est pas un fichier JSON valide.", e.message);
      return null;
    }
  }

  getDataFromChart(event) {
    const datasetIndex = event.active[0]._datasetIndex;
    const dataIndex = event.active[0]._index;
    return this.chartData[datasetIndex].data[dataIndex];
  }

  error(titre, message: string) {
    this.toastr.error(message, titre, {
      progressBar: true
    });
  }

  getDataFromFile(text) {
    this.repositoriesURL = text.repositories.filter(repository =>
      repository.match(/https:\/\/github.com\/[^\/]*\/[^\/]*/)
    );
    if (text.repositories.length !== this.repositoriesURL.length) {
      this.warning(
        'Attention',
        'Une ou plusieurs URL ne sont pas bien formatées !'
      );
    }
    this.corrections = text.corrections;
    this.seances = text.seances;
    this.reviews = text.reviews;
  }

  warning(titre, message) {
    this.toastr.warning(message, titre, {
      progressBar: true
    });
  }
}
