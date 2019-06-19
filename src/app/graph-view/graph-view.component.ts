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
import { validateConfig } from '@angular/router/src/config';
import { Repository } from '../models/Repository.model';
import { Session } from '../models/Session.model';
import { Jalon } from '../models/Jalon.model';
import * as Chart from 'chart.js';
import { NgForm } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import moment from 'moment/src/moment';
import { JsonManagerService } from '../services/json-manager.service';
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
    private jsonManager: JsonManagerService
  ) {}

  @ViewChild(BaseChartDirective) myChart: BaseChartDirective;

  loading = false;
  unit = 'day';
  corrections: Jalon[];
  sessions: Session[];
  reviews: Jalon[];
  others: Jalon[];
  repositories: Repository[];
  chartData = [{ data: [] }];
  tpGroup: string;
  tpGroups: Set<string>;
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
        lineBackgroundColor: 'rgba(76, 76, 76, 1)',
        borderColor: 'rgba(76, 76, 76, 1)',
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
    $('.btn').tooltip();
    $('.modal').modal({
      show: false
    });
    $('.dropdown-menu').mouseleave(function() {
      $('.dropdown-toggle').dropdown('toggle');
    });
  }

  readFile(): void {
    const myReader: FileReader = new FileReader();
    myReader.onloadend = e => {
      const text = this.getJSONOrNull(myReader.result);
      if (text /* TODO: && verifyJSON() */) {
        this.getDataFromFile(text);
        this.loadGraph(text.startDate, text.endDate);
        console.log(this.others);
      }
    };
    myReader.readAsText(this.jsonManager.file);
  }

  loadGraph(startDate?: Date, endDate?: Date) {
    this.loading = true;

    this.commitsService
      .getRepositories(this.repositories, startDate, endDate)
      .subscribe(
        repositories => {
          this.tpGroups = new Set();
          this.repositories = repositories;
          this.repositories.forEach(repository => {
            this.tpGroups.add(repository.tpGroup);
            console.log('repository.tpGroup: ', 'b' + repository.tpGroup + 'b');
          });
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
    this.loadPoints();
    this.refreshGraph();
  }

  loadAnnotations() {
    this.chartOptions.annotation.annotations = [];
    if (this.sessions && this.showSessions) {
      this.loadSessions();
    }

    if (this.reviews && this.showReviews) {
      this.loadReviews();
    }

    if (this.corrections && this.showCorrections) {
      this.loadCorrections();
    }

    if (this.others && this.showOthers) {
      this.loadOthers();
    }
  }

  loadSessions() {
    this.sessions
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
    this.reviews
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
    this.corrections
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
    this.others
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

    this.repositories
      .filter(
        repository => !this.tpGroup || repository.tpGroup === this.tpGroup
      )
      .forEach(repository => {
        // commits.push(repository.commits.slice());
        const data = [];
        const pointStyle = [];
        const reviews = this.reviews.filter(
          review => review.tpGroup === repository.tpGroup
        );
        const corrections = this.corrections.filter(
          correction => correction.tpGroup === repository.tpGroup
        );
        const pointBackgroundColor = [];
        labels.push(repository.name);
        repository.commits.forEach(commit => {
          commit.updateIsCloture();
          commit.updateColor(corrections, reviews);
          // commit = this.updateCommit(commit);

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
          pointBackgroundColor
        });
      });
    this.chartData = chartData;
    this.chartOptions.scales.yAxes[0].labels = labels;
  }

  // updateCommit(commit: Commit) {
  //   // if (this.sessions) {
  //   //   for (
  //   //     let i = 0;
  //   //     i < this.sessions.length &&
  //   //     !commit.updateIsEnSeance(
  //   //       this.sessions[i].startDate,
  //   //       this.sessions[i].endDate
  //   //     );
  //   //     i++
  //   //   ) {}
  //   // }
  //   commit.updateIsCloture();
  //   return commit;
  // }

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
    const jalon = new Jalon(
      new Date(form.value.date),
      form.value.label.trim(),
      form.value.tpGroup.trim()
    );

    if (form.value.jalon === 'correction') {
      if (!this.corrections) {
        this.corrections = [];
      }
      this.corrections.push(jalon);
      this.jsonManager.updateJSONWithCorrection(jalon);
    } else if (form.value.jalon === 'review') {
      if (!this.reviews) {
        this.reviews = [];
      }
      this.reviews.push(jalon);
      console.log('this.reviews: ', this.reviews);
      this.jsonManager.updateJSONWithReview(jalon);
    } else if (form.value.jalon === 'other') {
      if (!this.others) {
        this.others = [];
      }
      this.others.push(jalon);
      this.jsonManager.updateJSONWithOther(jalon);
    }

    this.jsonManager.generateDownloadUrlFromJson();

    this.loadGraphData();
    this.dispose();
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
    this.repositories = text.repositories
      .filter(repository =>
        repository.url.match(/https:\/\/github.com\/[^\/]*\/[^\/]*/)
      )
      .map(repository => Repository.withJSON(repository));
    if (text.repositories.length !== this.repositories.length) {
      this.warning(
        'Attention',
        'Une ou plusieurs URL ne sont pas bien formatées !'
      );
    }
    this.corrections = text.corrections
      ? text.corrections.map(data => Jalon.withJSON(data))
      : undefined;
    this.sessions = text.sessions
      ? text.sessions.map(data => Session.withJSON(data))
      : undefined;
    this.reviews = text.reviews
      ? text.reviews.map(data => Jalon.withJSON(data))
      : undefined;
    this.others = text.others
      ? text.others.map(data => Jalon.withJSON(data))
      : undefined;
    this.jsonManager.generateJson(
      this.repositories,
      this.sessions,
      this.corrections,
      this.reviews,
      this.others,
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

  dispose() {
    $('#exampleModal').modal('hide');
  }
}
