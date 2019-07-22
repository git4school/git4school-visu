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
import { Commit, CommitColor } from '../models/Commit.model';
import { ToastrService } from 'ngx-toastr';
import { Repository } from '../models/Repository.model';
import { Session } from '../models/Session.model';
import { Jalon } from '../models/Jalon.model';
import { NgForm } from '@angular/forms';
import moment from 'moment/src/moment';
import { JsonManagerService } from '../services/json-manager.service';
import { DataService } from '../services/data.service';
import * as JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as Ajv from 'ajv';
import { TranslateService, TranslationChangeEvent } from '@ngx-translate/core';

declare var $: any;

@Component({
  selector: 'app-graph-view',
  templateUrl: './graph-view.component.html',
  styleUrls: ['./graph-view.component.scss']
})
export class GraphViewComponent implements OnInit {
  constructor(
    private translate: TranslateService,
    private commitsService: CommitsService,
    private toastr: ToastrService,
    public jsonManager: JsonManagerService,
    public dataService: DataService
  ) {}

  @ViewChild(BaseChartDirective) myChart;

  typeaheadSettings;
  loading = false;
  searchFilter: string[] = [];
  unit = 'day';
  drag = true;
  chartData = [{ data: [] }];
  tpGroup: string;
  showSessions = true;
  showCorrections = true;
  showReviews = true;
  showOthers = true;

  // Modal variables
  dateModal;
  labelModal: string;
  tpGroupModal: string;
  questionsModal: string[];
  typeModal: string;
  addModal: boolean;
  savedMilestoneModal: Jalon;
  ////////////////////////

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
              week: 'DD/MM/YY',
              hour: 'kk:mm'
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
      events: ['click'],
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
          onZoom: ({ chart }) => this.adaptScaleWithChart(chart)
        }
      }
    }
  };

  ngOnInit(): void {
    this.updateLang();
    this.translate.onLangChange.subscribe((event: TranslationChangeEvent) => {
      this.updateLang();
    });
    $('.modal').modal({
      show: false
    });
    if (this.dataService.repositories) {
      // this.loadGraphData();
      this.loadGraph(this.dataService.startDate, this.dataService.endDate);
    } else {
      $('#uploadFileModal').modal({
        show: true
      });
    }
  }
  updateLang() {
    this.translate.get('SEARCH-NOT-FOUND').subscribe(r => {
      this.typeaheadSettings = {
        tagClass: 'badge badge-pill badge-secondary mr-1',
        noMatchesText: r,
        suggestionLimit: 5
      };
    });
  }

  readFile(): void {
    const myReader: FileReader = new FileReader();
    myReader.onloadend = e => {
      let text = null;
      try {
        text = JSON.parse(myReader.result.toString());
      } catch (e) {
        this.translate
          .get('INVALID-JSON')
          .subscribe(translation => this.error(translation, e.message));
      }
      if (text && this.verifyJSON(text)) {
        this.getDataFromFile(text);
        setTimeout(() => {
          this.loadGraph(text.startDate, text.endDate);
        });
        $('#uploadFileModal').modal('hide');
      }
    };
    myReader.readAsText(this.jsonManager.file);
  }

  loadGraph(startDate?: String, endDate?: String) {
    this.loading = true;

    this.commitsService
      .getRepositories(this.dataService.repositories, startDate, endDate)
      .subscribe(repositories => {
        try {
          let tpGroups = new Set<string>();
          repositories.forEach((repository, index) => {
            this.dataService.repositories[
              index
            ] = this.commitsService.getRepositoryFromRaw(
              this.dataService.repositories[index],
              repository
            );
            tpGroups.add(this.dataService.repositories[index].tpGroup);
          });
          this.dataService.tpGroups = Array.from(tpGroups);
          this.loadGraphDataAndRefresh();
          this.dataService.lastUpdateDate = new Date();
        } catch (err) {
          this.translate
            .get('GIT-ERROR')
            .subscribe(translation => this.error(translation, err));
        } finally {
          this.loading = false;
        }
      });
  }

  loadGraphData() {
    this.loadAnnotations();
    this.loadPoints();
    setTimeout(() => {
      this.adaptScaleWithChart(this.myChart.chart);
    });
  }

  loadGraphDataAndRefresh() {
    this.loadGraphData();
    this.refreshGraph();
    this.adaptScaleWithChart(this.myChart.chart);
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
    let me = this;
    this.dataService.reviews
      .filter(
        review =>
          (!this.tpGroup || review.tpGroup === this.tpGroup) &&
          (!this.searchFilter.length ||
            (review.questions &&
              this.searchFilter.filter(question =>
                review.questions.includes(question)
              ).length))
      )
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
          },
          onClick: function(e) {
            me.showEditMilestoneModal(review);
          }
        });
      });
  }

  loadCorrections() {
    let me = this;
    this.dataService.corrections
      .filter(
        correction =>
          (!this.tpGroup || correction.tpGroup === this.tpGroup) &&
          (!this.searchFilter.length ||
            (correction.questions &&
              this.searchFilter.filter(question =>
                correction.questions.includes(question)
              ).length))
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
          },
          onClick: function(e) {
            me.showEditMilestoneModal(correction);
          }
        });
      });
  }

  loadOthers() {
    let me = this;
    this.dataService.others
      .filter(
        other =>
          (!this.tpGroup || other.tpGroup === this.tpGroup) &&
          (!this.searchFilter.length ||
            (other.questions &&
              this.searchFilter.filter(question =>
                other.questions.includes(question)
              ).length))
      )
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
          },
          onClick: function(e) {
            me.showEditMilestoneModal(other);
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
          commit.updateMetadata(
            reviews,
            corrections,
            this.dataService.questions
          );
          if (
            !this.searchFilter.length ||
            this.searchFilter.includes(commit.question)
          ) {
            data.push({
              x: commit.commitDate,
              y: repository.name,
              commit
            });
            pointStyle.push(this.getPointStyle(commit));
            pointBackgroundColor.push(commit.color.color);
          }
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
    this.selectZoom(this.drag);
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
      const rawDate = this.getValueFromEvent(event);
      this.showAddMilestoneModal(rawDate);
    }
  }

  showAddMilestoneModal(date) {
    this.dateModal = date.format('YYYY-MM-DDTHH:mm');
    this.labelModal = '';
    this.tpGroupModal = '';
    this.questionsModal = [];
    this.typeModal = '';
    this.addModal = true;
    this.showModal();
  }

  showEditMilestoneModal(milestone: Jalon) {
    this.dateModal = moment(milestone.date).format('YYYY-MM-DDTHH:mm');
    this.labelModal = milestone.label;
    this.tpGroupModal = milestone.tpGroup;
    this.questionsModal = milestone.questions ? milestone.questions : [];
    this.typeModal = milestone.type;
    this.addModal = false;
    this.savedMilestoneModal = milestone;
    this.showModal();
  }

  showModal() {
    console.log(this.labelModal);
    $('#addMilestoneModal').modal('show');
  }

  getValueFromEvent(event) {
    const xAxis = this.myChart.chart.scales['x-axis-0'];
    const x = event.event.offsetX;
    return xAxis.getValueForPixel(x);
  }

  onChartHover(event) {
    const data = this.getDataFromChart(event);
  }

  onSubmit(form: NgForm) {
    const questions = form.value.questions;
    console.log('form', form.value);

    const jalon = new Jalon(
      new Date(form.value.date),
      form.value.label.trim(),
      questions.length ? questions : null,
      (form.value.tpGroup || '').trim(),
      form.value.jalon
    );

    if (!this.addModal) {
      this.deleteElement(
        this.savedMilestoneModal,
        this.dataService[this.savedMilestoneModal.type]
      );
    }

    if (!this.dataService[jalon.type]) {
      this.dataService[jalon.type] = [];
    }
    this.dataService[jalon.type].push(jalon);

    form.resetForm({
      date: '',
      label: '',
      questions: [],
      tpGroup: '',
      jalon: ''
    });

    this.loadGraphDataAndRefresh();
    this.dispose();
    this.translate.get(['SUCCESS', 'MILESTONE-SAVED']).subscribe(translations =>
      this.toastr.success(
        translations['MILESTONE-SAVED'],
        translations['SUCCESS'],
        {
          progressBar: true
        }
      )
    );
  }

  deleteMilestone() {
    this.dataService[this.savedMilestoneModal.type].splice(
      this.dataService[this.savedMilestoneModal.type].indexOf(
        this.savedMilestoneModal
      ),
      1
    );

    this.loadGraphDataAndRefresh();
    this.dispose();
    this.translate
      .get(['SUCCESS', 'MILESTONE-DELETED'])
      .subscribe(translations =>
        this.toastr.success(
          translations['MILESTONE-DELETED'],
          translations['SUCCESS'],
          {
            progressBar: true
          }
        )
      );
  }

  deleteElement(element, list) {
    list.splice(list.indexOf(element), 1).slice();
  }

  selectUnit(unit: string) {
    this.unit = unit;
    this.myChart.chart.options.scales.xAxes[0].time.unit = unit;
    // this.refreshGraph();
    this.myChart.chart.update();
  }

  changeUnit() {
    if (this.unit === 'week') {
      this.selectUnit('day');
    } else if (this.unit === 'day') {
      this.selectUnit('hour');
    } else if (this.unit === 'hour') {
      this.selectUnit('week');
    }
  }

  getPointStyle(commit: Commit) {
    if (commit.isCloture) {
      return 'circle';
    } else {
      return 'rectRot';
    }
  }

  getDataFromChart(event) {
    const datasetIndex = event.active[0]._datasetIndex;
    const dataIndex = event.active[0]._index;
    return this.chartData[datasetIndex].data[dataIndex];
  }

  error(titre, message: string) {
    this.toastr.error(message, titre, {
      progressBar: true,
      enableHtml: true
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
    this.dataService.startDate = text.startDate;
    this.dataService.endDate = text.endDate;
    this.dataService.title = text.title;
    this.dataService.course = text.course;
    this.dataService.program = text.program;
    this.dataService.year = text.year;
    this.dataService.questions = text.questions;
    this.dataService.corrections = text.corrections
      ? text.corrections.map(data => Jalon.withJSON(data, 'corrections'))
      : undefined;
    this.dataService.sessions = text.sessions
      ? text.sessions.map(data => Session.withJSON(data))
      : undefined;
    this.dataService.reviews = text.reviews
      ? text.reviews.map(data => Jalon.withJSON(data, 'reviews'))
      : undefined;
    this.dataService.others = text.others
      ? text.others.map(data => Jalon.withJSON(data, 'others'))
      : undefined;
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
    this.adaptScaleWithChart(this.myChart.chart);
  }

  changeZoom() {
    let zoomOptions = this.myChart.chart.options.plugins.zoom.zoom;

    this.selectZoom(!zoomOptions.drag);

    this.myChart.chart.update();
  }

  selectZoom(drag: boolean) {
    let zoomOptions = this.myChart.chart.options.plugins.zoom.zoom;
    let panOptions = this.myChart.chart.options.plugins.zoom.pan;

    zoomOptions.drag = drag;
    this.drag = drag;
    panOptions.enabled = !drag;
  }

  dispose() {
    $('#addMilestoneModal').modal('hide');
  }

  searchSubmit(form: NgForm) {
    this.searchFilter = form.value.search;
    this.loadGraphDataAndRefresh();
  }

  adaptScaleWithChart(chart) {
    let min = new Date(chart.scales['x-axis-0'].min);
    let max = new Date(chart.scales['x-axis-0'].max);
    this.adaptScale(min, max);
  }

  adaptScale(min, max) {
    let distance = (max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24);

    if (this.unit == 'day') {
      if (Math.round(distance) > 7) {
        this.selectUnit('week');
      } else if (Math.floor(distance) < 1) {
        this.selectUnit('hour');
      }
    } else if (this.unit == 'week') {
      if (Math.round(distance) < 9) {
        this.selectUnit('day');
      }
    } else if (this.unit == 'hour') {
      if (Math.round(distance) > 1) {
        this.selectUnit('day');
      }
    }
  }

  download() {
    this.dataService.generateJSON();
    let colors = [
      CommitColor.BEFORE,
      CommitColor.BETWEEN,
      CommitColor.AFTER,
      CommitColor.NOCOMMIT
    ];
    let shortFilenameTab = this.jsonManager.filename.split('.');
    shortFilenameTab.pop();
    let shortFilename = shortFilenameTab.join('.');

    let questionsDict = this.commitsService.initQuestionsDict(
      this.dataService.questions,
      colors
    );
    questionsDict = this.commitsService.loadQuestionsDict(
      questionsDict,
      this.dataService.repositories,
      this.dataService.questions,
      colors
    );
    questionsDict['date'] = this.dataService.lastUpdateDate;

    colors = [
      CommitColor.INTERMEDIATE,
      CommitColor.BEFORE,
      CommitColor.BETWEEN,
      CommitColor.AFTER
    ];

    let studentsDict = {
      date: this.dataService.lastUpdateDate,
      students: this.commitsService.loadStudentsDict(
        this.dataService.repositories,
        this.dataService.questions,
        colors
      )
    };

    let zip = new JSZip();
    zip.file(
      this.jsonManager.filename,
      JSON.stringify(this.jsonManager.json, null, 2)
    );
    zip.file(
      'questions-completion.json',
      JSON.stringify(questionsDict, null, 2)
    );
    zip.file('students-commits.json', JSON.stringify(studentsDict, null, 2));

    zip.generateAsync({ type: 'blob' }).then(function(content) {
      // see FileSaver.js
      saveAs(content, shortFilename + '.zip');
    });
  }

  verifyJSON(json) {
    let schema = {
      properties: {
        title: {
          type: 'string'
        },
        course: {
          type: 'string'
        },
        program: {
          type: 'string'
        },
        year: {
          type: 'string'
        },
        startDate: {
          type: 'string',
          pattern:
            '([0-9]{4}-[0-1][0-9]-[0-3][0-9] [0-2][0-9]:[0-5][0-9])|([0-9]{4}-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9](:[0-5][0-9])?(.[0-9]{3}Z?)?)'
        },
        endDate: {
          type: 'string',
          pattern:
            '([0-9]{4}-[0-1][0-9]-[0-3][0-9] [0-2][0-9]:[0-5][0-9])|([0-9]{4}-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9](:[0-5][0-9])?(.[0-9]{3}Z?)?)'
        },
        questions: {
          type: 'array',
          uniqueItems: true,
          items: {
            type: 'string'
          }
        },
        repositories: {
          type: 'array',
          uniqueItems: true,
          minItems: 1,
          items: {
            properties: {
              url: {
                type: 'string',
                format: 'uri'
              },
              name: {
                type: 'string'
              },
              tpGroup: {
                type: 'string'
              }
            },
            required: ['url']
          }
        },
        sessions: {
          type: 'array',
          uniqueItems: true,
          items: {
            properties: {
              startDate: {
                type: 'string',
                pattern:
                  '([0-9]{4}-[0-1][0-9]-[0-3][0-9] [0-2][0-9]:[0-5][0-9])|([0-9]{4}-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9](:[0-5][0-9])?(.[0-9]{3}Z?)?)'
              },
              endDate: {
                type: 'string',
                pattern:
                  '([0-9]{4}-[0-1][0-9]-[0-3][0-9] [0-2][0-9]:[0-5][0-9])|([0-9]{4}-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9](:[0-5][0-9])?(.[0-9]{3}Z?)?)'
              },
              tpGroup: {
                type: 'string'
              }
            },
            required: ['startDate', 'endDate']
          }
        },
        reviews: {
          type: 'array',
          uniqueItems: true,
          items: {
            properties: {
              date: {
                type: 'string',
                pattern:
                  '([0-9]{4}-[0-1][0-9]-[0-3][0-9] [0-2][0-9]:[0-5][0-9])|([0-9]{4}-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9](:[0-5][0-9])?(.[0-9]{3}Z?)?)'
              },
              label: {
                type: 'string'
              },
              tpGroup: {
                type: 'string'
              },
              questions: {
                type: 'array',
                uniqueItems: true,
                items: {
                  type: 'string'
                }
              }
            },
            required: ['date']
          }
        },
        corrections: {
          type: 'array',
          uniqueItems: true,
          items: {
            properties: {
              date: {
                type: 'string',
                pattern:
                  '([0-9]{4}-[0-1][0-9]-[0-3][0-9] [0-2][0-9]:[0-5][0-9])|([0-9]{4}-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9](:[0-5][0-9])?(.[0-9]{3}Z?)?)'
              },
              label: {
                type: 'string'
              },
              tpGroup: {
                type: 'string'
              },
              questions: {
                type: 'array',
                uniqueItems: true,
                items: {
                  type: 'string'
                }
              }
            },
            required: ['date']
          }
        },
        others: {
          type: 'array',
          uniqueItems: true,
          items: {
            properties: {
              date: {
                type: 'string',
                pattern:
                  '([0-9]{4}-[0-1][0-9]-[0-3][0-9] [0-2][0-9]:[0-5][0-9])|([0-9]{4}-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9](:[0-5][0-9])?(.[0-9]{3}Z?)?)'
              },
              label: {
                type: 'string'
              },
              tpGroup: {
                type: 'string'
              },
              questions: {
                type: 'array',
                uniqueItems: true,
                items: {
                  type: 'string'
                }
              }
            },
            required: ['date']
          }
        }
      },
      required: ['title', 'questions', 'repositories']
    };

    let ajv = new Ajv({ $data: true, allErrors: true, verbose: true });
    let valid = ajv.validate(schema, json);

    if (!valid) {
      let errorMessage =
        '&emsp;' +
        ajv.errors
          .map(error => {
            return error.dataPath + ' ' + error.message;
          })
          .join('<br>&emsp;');
      this.translate
        .get('INVALID-CONF-FILE')
        .subscribe(translation => this.error(translation, errorMessage));

      return false;
    }

    return true;
  }
}
