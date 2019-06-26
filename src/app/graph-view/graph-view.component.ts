import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  HostListener
} from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { AuthService } from '../services/auth.service';
import { CommitsService } from '../services/commits.service';
import { Commit } from '../models/Commit.model';
import { ToastrService } from 'ngx-toastr';
import { Repository } from '../models/Repository.model';
import { Session } from '../models/Session.model';
import { Jalon } from '../models/Jalon.model';
import { NgForm } from '@angular/forms';
import moment from 'moment/src/moment';
import { JsonManagerService } from '../services/json-manager.service';
import { DataService } from '../services/data.service';
import * as Chart from 'chart.js';
import * as ChartDataLabels from 'chartjs-plugin-datalabels';
declare var $: any;

@Component({
  selector: 'app-graph-view',
  templateUrl: './graph-view.component.html',
  styleUrls: ['./graph-view.component.scss']
})
export class GraphViewComponent implements OnInit {
  constructor(
    private authService: AuthService,
    private commitsService: CommitsService,
    private toastr: ToastrService,
    public jsonManager: JsonManagerService,
    public dataService: DataService
  ) {}

  @ViewChild(BaseChartDirective) myChart;

  loading = false;
  unit = 'day';
  chartData = [{ data: [] }];
  tpGroup: string;
  showSessions = true;
  showCorrections = true;
  showReviews = true;
  showOthers = true;
  dateAjoutJalon;

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
        tension: 0
      },
      point: {
        hitRadius: 8,
        radius: 6
        // borderWidth: 1,
        // pointRadius: 7,
        // pointHoverRadius: 8,
        // pointBorderColor: 'black'
      }
    },
    scales: {
      xAxes: [
        {
          offset: true,
          type: 'time',
          time: {
            unit: this.unit,
            tooltipFormat: 'DD/MM/YY HH:mm',
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
          enabled: false,
          mode: 'x',
          onPan({ chart }) {}
        },
        zoom: {
          enabled: true,
          drag: {
            borderColor: 'rgba(225,225,225,0.3)',
            borderWidth: 5,
            backgroundColor: 'rgb(225,225,225)'
          },
          mode: 'x',
          speed: 0.3,
          onZoom: ({ chart }) => {}
        }
      }
    }
  };

  ngOnInit(): void {
    Chart.pluginService.unregister(ChartDataLabels);
    $('.btn').tooltip();
    $('#questions-tooltip').tooltip();
    $('.modal').modal({
      show: false
    });
    if (this.dataService.repositories) {
      this.loadGraphData();
    }
  }

  readFile(): void {
    const myReader: FileReader = new FileReader();
    myReader.onloadend = e => {
      let text = null;
      try {
        text = JSON.parse(myReader.result.toString());
      } catch (e) {
        this.error("Le fichier n'est pas un fichier JSON valide.", e.message);
      }
      if (text /* TODO: && verifyJSON() */) {
        this.getDataFromFile(text);
        this.loadGraph(text.startDate, text.endDate);
        console.log(this.dataService.others);
      }
    };
    myReader.readAsText(this.jsonManager.file);
  }

  loadGraph(startDate?: String, endDate?: String) {
    this.loading = true;

    this.commitsService
      .getRepositories(this.dataService.repositories, startDate, endDate)
      .subscribe(
        repositories => {
          this.dataService.tpGroups = new Set();
          this.dataService.repositories = repositories;
          this.dataService.repositories.forEach(repository => {
            this.dataService.tpGroups.add(repository.tpGroup);
          });
          this.loadGraphDataAndRefresh();
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
    this.loadPoints();
  }

  loadGraphDataAndRefresh() {
    this.loadGraphData();
    this.refreshGraph();
  }

  loadAnnotations() {
    this.chartOptions.annotation.annotations = [];
    if (this.dataService.sessions && this.showSessions) {
      this.loadSessions();
    }

    if (this.dataService.reviews && this.showReviews) {
      this.loadReviews();
    }

    if (this.dataService.corrections && this.showCorrections) {
      this.loadCorrections();
    }

    if (this.dataService.others && this.showOthers) {
      this.loadOthers();
    }
  }

  loadSessions() {
    this.dataService.sessions
      .filter(session => !this.tpGroup || session.tpGroup === this.tpGroup)
      .forEach(session => {
        this.chartOptions.annotation.annotations.push({
          type: 'box',
          xScaleID: 'x-axis-0',
          yScaleID: 'y-axis-0',
          xMin: session.startDate,
          xMax: session.endDate,
          borderColor: 'rgba(79, 195, 247,1.0)',
          borderWidth: 2,
          backgroundColor: 'rgba(33, 150, 243, 0.15)'
        });
      });
  }

  loadReviews() {
    this.dataService.reviews
      .filter(review => !this.tpGroup || review.tpGroup === this.tpGroup)
      .forEach((review, index) => {
        this.chartOptions.annotation.annotations.push({
          type: 'line',
          mode: 'vertical',
          scaleID: 'x-axis-0',
          value: review.date,
          borderColor: 'blue',
          borderWidth: 1,
          label: {
            content: review.label || 'Review ' + (index + 1),
            enabled: true,
            position: 'top'
          }
        });
      });
  }

  loadCorrections() {
    this.dataService.corrections
      .filter(
        correction => !this.tpGroup || correction.tpGroup === this.tpGroup
      )
      .forEach((correction, index) => {
        this.chartOptions.annotation.annotations.push({
          type: 'line',
          mode: 'vertical',
          scaleID: 'x-axis-0',
          value: correction.date,
          borderColor: 'red',
          borderWidth: 1,
          label: {
            content: correction.label || 'Correction ' + (index + 1),
            enabled: true,
            position: 'top'
          }
        });
      });
  }

  loadOthers() {
    this.dataService.others
      .filter(other => !this.tpGroup || other.tpGroup === this.tpGroup)
      .forEach((other, index) => {
        this.chartOptions.annotation.annotations.push({
          type: 'line',
          mode: 'vertical',
          scaleID: 'x-axis-0',
          value: other.date,
          borderColor: 'black',
          borderWidth: 1,
          label: {
            content: other.label || 'Other ' + (index + 1),
            enabled: true,
            position: 'top'
          }
        });
      });
  }

  loadPoints() {
    const chartData = [];
    const labels = [];
    const commits = [];

    this.dataService.repositories
      .filter(
        repository => !this.tpGroup || repository.tpGroup === this.tpGroup
      )
      .forEach(repository => {
        const data = [];
        const pointStyle = [];
        const reviews = !this.dataService.reviews
          ? null
          : this.dataService.reviews.filter(
              review => review.tpGroup === repository.tpGroup
            );
        const corrections = !this.dataService.corrections
          ? null
          : this.dataService.corrections.filter(
              correction => correction.tpGroup === repository.tpGroup
            );
        const pointBackgroundColor = [];
        const borderColor = 'rgba(77, 77, 77, 0.5)';
        labels.push(repository.name);
        repository.commits.forEach(commit => {
          // commit.updateQuestion();
          commit.updateIsCloture();
          commit.updateColor(corrections, reviews);

          data.push({
            x: commit.commitDate,
            y: repository.name,
            commit
          });
          pointStyle.push(this.getPointStyle(commit));
          pointBackgroundColor.push(commit.color);
        });
        chartData.push({
          data,
          pointStyle,
          pointBackgroundColor,
          borderColor
        });
      });
    this.chartData = chartData;
    this.chartOptions.scales.yAxes[0].labels = labels;
  }

  refreshGraph() {
    this.myChart.chart.destroy();
    this.myChart.ngOnInit();
  }

  changeListener($event): void {
    if ($event.target.files[0]) {
      this.jsonManager.file = $event.target.files[0];
      this.jsonManager.filename = this.jsonManager.file.name;
      this.readFile();
    }
  }

  onChartClick(event) {
    if (event.active.length > 0) {
      const data = this.getDataFromChart(event);
      // tslint:disable-next-line: no-string-literal
      window.open(data.commit.url, '_blank');
    } else {
      if (event.event.shiftKey) {
        const xAxis = this.myChart.chart.scales['x-axis-0'];
        const x = event.event.offsetX;
        const index = xAxis.getValueForPixel(x);
        this.dateAjoutJalon = moment(index.toDate()).format('YYYY-MM-DDTHH:mm');
        $('#exampleModal').modal('show');
      }
    }
  }

  onChartHover(event) {
    const data = this.getDataFromChart(event);
    console.log(data.commit.color);
  }

  onSubmit(form: NgForm) {
    const questions = form.value.questions
      .split(',')
      .map(question => question.trim());

    const jalon = new Jalon(
      new Date(form.value.date),
      form.value.label.trim(),
      questions,
      form.value.tpGroup.trim()
    );
    console.log(jalon);

    if (form.value.jalon === 'correction') {
      if (!this.dataService.corrections) {
        this.dataService.corrections = [];
      }
      this.dataService.corrections.push(jalon);
      this.jsonManager.updateJSONWithCorrection(jalon);
    } else if (form.value.jalon === 'review') {
      if (!this.dataService.reviews) {
        this.dataService.reviews = [];
      }
      this.dataService.reviews.push(jalon);
      console.log('this.dataService.reviews: ', this.dataService.reviews);
      this.jsonManager.updateJSONWithReview(jalon);
    } else if (form.value.jalon === 'other') {
      if (!this.dataService.others) {
        this.dataService.others = [];
      }
      this.dataService.others.push(jalon);
      this.jsonManager.updateJSONWithOther(jalon);
    }

    this.jsonManager.generateDownloadUrlFromJson();

    this.loadGraphDataAndRefresh();
    this.dispose();
  }

  changeUnit() {
    console.log(this.myChart.chart.options);
    if (this.unit === 'week') {
      this.unit = 'day';
    } else if (this.unit === 'day') {
      this.unit = 'hour';
    } else if (this.unit === 'hour') {
      this.unit = 'week';
    }
    this.myChart.chart.options.scales.xAxes[0].time.unit = this.unit;
    // this.refreshGraph();
    this.myChart.chart.update();
  }

  verifyJSON() {
    // TODO: Envoyer des alertes (warning et error), renvoie false s'il y a une erreur, true s'il y a seulement warning ou rien
  }

  getPointStyle(commit: Commit) {
    if (commit.isCloture) {
      return 'rectRot';
    } else {
      return 'circle';
    }
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
    this.dataService.repositories = text.repositories
      .filter(repository =>
        repository.url.match(/https:\/\/github.com\/[^\/]*\/[^\/]*/)
      )
      .map(repository => Repository.withJSON(repository));
    if (text.repositories.length !== this.dataService.repositories.length) {
      this.warning(
        'Attention',
        'Une ou plusieurs URL ne sont pas bien formatées !'
      );
    }
    this.dataService.corrections = text.corrections
      ? text.corrections.map(data => Jalon.withJSON(data))
      : undefined;
    this.dataService.sessions = text.sessions
      ? text.sessions.map(data => Session.withJSON(data))
      : undefined;
    this.dataService.reviews = text.reviews
      ? text.reviews.map(data => Jalon.withJSON(data))
      : undefined;
    this.dataService.others = text.others
      ? text.others.map(data => Jalon.withJSON(data))
      : undefined;
    this.jsonManager.generateJson(
      this.dataService.repositories,
      this.dataService.sessions,
      this.dataService.corrections,
      this.dataService.reviews,
      this.dataService.others,
      text.startDate,
      text.endDate
    );
    this.jsonManager.generateDownloadUrlFromJson();
  }

  warning(titre, message) {
    this.toastr.warning(message, titre, {
      progressBar: true
    });
  }

  @HostListener('window:keyup', ['$event'])
  keyEvent(event: KeyboardEvent) {
    if (event.keyCode === 32) {
      this.resetZoom();
    }
  }

  resetZoom() {
    this.myChart.chart.resetZoom();
  }

  changeZoom() {
    var zoomOptions = this.myChart.chart.options.plugins.zoom.zoom;
    var panOptions = this.myChart.chart.options.plugins.zoom.pan;

    if (zoomOptions.drag) {
      // drag
      zoomOptions.drag = false;
      panOptions.enabled = true;
    } else {
      //wheel
      zoomOptions.drag = true;
      panOptions.enabled = false;
    }
    this.myChart.chart.update();
  }

  dispose() {
    $('#exampleModal').modal('hide');
  }
}
