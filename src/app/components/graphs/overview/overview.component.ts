import {
  AfterViewInit,
  Component,
  HostListener,
  OnInit,
  ViewChild,
} from "@angular/core";
import { NgForm } from "@angular/forms";
import { Commit, CommitColor } from "@models/Commit.model";
import { Milestone } from "@models/Milestone.model";
import { Repository } from "@models/Repository.model";
import { Session } from "@models/Session.model";
import { TranslateService, TranslationChangeEvent } from "@ngx-translate/core";
import { CommitsService } from "@services/commits.service";
import { DataService } from "@services/data.service";
import { JsonManagerService } from "@services/json-manager.service";
import { LoaderService } from "@services/loader.service";
import { ToastService } from "@services/toast.service";
import * as Ajv from "ajv";
import { saveAs } from "file-saver";
import * as JSZip from "jszip";
import * as moment from "moment";
import { BaseChartDirective } from "ng2-charts";
import { BaseGraphComponent } from "../base-graph.component";

/**
 * jquery
 */
declare var $: any;

@Component({
  selector: "overview",
  templateUrl: "./overview.component.html",
  styleUrls: ["./overview.component.scss"],
})
export class OverviewComponent
  extends BaseGraphComponent
  implements OnInit, AfterViewInit {
  constructor(
    private translateService: TranslateService,
    private commitsService: CommitsService,
    private toastService: ToastService,
    public jsonManager: JsonManagerService,
    public dataService: DataService,
    protected loaderService: LoaderService
  ) {
    super(loaderService);
  }

  @ViewChild(BaseChartDirective, { static: true }) myChart;

  typeaheadSettings;
  searchFilter: string[] = [];
  unit = "day";
  drag = false;
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
  savedMilestoneModal: Milestone;
  ////////////////////////

  chartOptions = {
    responsive: true,
    aspectRatio: 2.4,
    animation: {
      duration: 0,
    },
    responsiveAnimationDuration: 0,
    hover: {
      mode: "nearest",
      intersec: true,
      animationDuration: 0,
    },
    interaction: {
      mode: "nearest",
    },
    tooltips: {
      callbacks: {
        label(tooltipItem, data) {
          return "";
        },
        beforeBody(tooltipItem, data) {
          const commit =
            data.datasets[tooltipItem[0].datasetIndex].data[
              tooltipItem[0].index
            ].commit;
          return commit.message + "\n\n" + commit.author;
        },
      },
      displayColors: false,
    },
    elements: {
      line: {
        fill: false,
        borderWidth: 2,
        tension: 0,
      },
      point: {
        hitRadius: 8,
        radius: 6,
      },
    },
    scales: {
      xAxes: [
        {
          offset: true,
          type: "time",
          time: {
            unit: this.unit,
            tooltipFormat: "DD/MM/YY HH:mm",
            displayFormats: {
              day: "DD/MM/YY",
              week: "DD/MM/YY",
              hour: "kk:mm",
            },
          },
        },
      ],
      yAxes: [
        {
          type: "category",
          labels: [],
          offset: true,
        },
      ],
    },
    annotation: {
      drawTime: "beforeDatasetsDraw",
      events: ["click", "mouseenter"],
      annotations: [],
    },
    plugins: {
      zoom: {
        pan: {
          enabled: false,
          mode: "x",
          onPan({ chart }) {},
        },
        zoom: {
          enabled: true,
          drag: {
            borderColor: "rgba(225,225,225,0.3)",
            borderWidth: 5,
            backgroundColor: "rgb(225,225,225)",
          },
          mode: "x",
          speed: 0.3,
          onZoom: ({ chart }) => this.adaptScaleWithChart(chart),
        },
      },
    },
  };

  ngOnInit(): void {
    this.updateLang();
    this.translateService.onLangChange.subscribe(
      (event: TranslationChangeEvent) => {
        this.updateLang();
      }
    );
    $(".modal").modal({
      show: false,
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (this.dataService.repoToLoad) {
        this.loadGraph(this.dataService.startDate, this.dataService.endDate);
      } else {
        this.loading = true;
        this.loadGraphMetadata(
          this.dataService.repositories,
          this.dataService.reviews,
          this.dataService.corrections,
          this.dataService.questions
        );

        this.loading = false;
      }
    });
  }

  updateLang() {
    this.typeaheadSettings = {
      tagClass: "badge badge-pill badge-secondary mr-1",
      noMatchesText: this.translateService.instant("SEARCH-NOT-FOUND"),
      suggestionLimit: 5,
    };
  }

  readFile(): void {
    const myReader: FileReader = new FileReader();
    myReader.onloadend = (e) => {
      let text = null;
      try {
        text = JSON.parse(myReader.result.toString());
      } catch (e) {
        this.toastService.error(
          this.translateService.instant("INVALID-JSON"),
          e.message
        );
      }
      if (text && this.verifyJSON(text)) {
        this.getDataFromFile(text);
        this.dataService.saveData();
        setTimeout(() => {
          this.loadGraph(text.startDate, text.endDate);
        });
        $("#uploadFileModal").modal("hide");
      }
    };
    myReader.readAsText(this.jsonManager.file);
  }

  loadGraph(startDate?: string, endDate?: string) {
    try {
      this.loading = true;

      this.loaderService.loadRepositories(startDate, endDate).subscribe(() => {
        this.loadGraphMetadata(
          this.dataService.repositories,
          this.dataService.reviews,
          this.dataService.corrections,
          this.dataService.questions
        );
        this.loading = false;
      });
    } catch (error) {
      this.loading = false;
    }
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
      .filter((session) => !this.tpGroup || session.tpGroup === this.tpGroup)
      .forEach((session) => {
        this.chartOptions.annotation.annotations.push({
          type: "box",
          xScaleID: "x-axis-0",
          yScaleID: "y-axis-0",
          xMin: session.startDate,
          xMax: session.endDate,
          borderColor: "rgba(79, 195, 247,1.0)",
          borderWidth: 2,
          backgroundColor: "rgba(33, 150, 243, 0.15)",
        });
      });
  }

  loadReviews() {
    let me = this;
    this.dataService.reviews
      .filter(
        (review) =>
          (!this.tpGroup || review.tpGroup === this.tpGroup) &&
          (!this.searchFilter.length ||
            this.searchFilter.filter((question) =>
              review.questions?.includes(question)
            ).length)
      )
      .forEach((review, index) => {
        this.chartOptions.annotation.annotations.push({
          type: "line",
          mode: "vertical",
          scaleID: "x-axis-0",
          value: review.date,
          borderColor: "blue",
          borderWidth: 1,
          label: {
            content: review.label || "Review " + (index + 1),
            enabled: true,
            position: "top",
          },
          onClick: function (e) {
            me.showEditMilestoneModal(review);
          },
        });
      });
  }

  loadCorrections() {
    let me = this;
    this.dataService.corrections
      .filter(
        (correction) =>
          (!this.tpGroup || correction.tpGroup === this.tpGroup) &&
          (!this.searchFilter.length ||
            this.searchFilter.filter((question) =>
              correction.questions?.includes(question)
            ).length)
      )
      .forEach((correction, index) => {
        this.chartOptions.annotation.annotations.push({
          type: "line",
          mode: "vertical",
          scaleID: "x-axis-0",
          value: correction.date,
          borderColor: "red",
          borderWidth: 1,
          label: {
            content: correction.label || "Correction " + (index + 1),
            enabled: true,
            position: "top",
          },
          onClick: function (e) {
            me.showEditMilestoneModal(correction);
          },
        });
      });
  }

  loadOthers() {
    let me = this;
    this.dataService.others
      .filter(
        (other) =>
          (!this.tpGroup || other.tpGroup === this.tpGroup) &&
          (!this.searchFilter.length ||
            this.searchFilter.filter((question) =>
              other.questions?.includes(question)
            ).length)
      )
      .forEach((other, index) => {
        this.chartOptions.annotation.annotations.push({
          type: "line",
          mode: "vertical",
          scaleID: "x-axis-0",
          value: other.date,
          borderColor: "black",
          borderWidth: 1,
          label: {
            content: other.label || "Other " + (index + 1),
            enabled: true,
            position: "top",
          },
          onClick: function (e) {
            me.showEditMilestoneModal(other);
          },
        });
      });
  }

  loadPoints() {
    const chartData = [];
    const labels = [];
    const commits = [];

    this.dataService.repositories
      .filter(
        (repository) => !this.tpGroup || repository.tpGroup === this.tpGroup
      )
      .forEach((repository) => {
        const data = [];
        const pointStyle = [];
        // const reviews = !this.dataService.reviews
        //   ? null
        //   : this.dataService.reviews.filter(
        //     review => review.tpGroup === repository.tpGroup
        //   );
        // const corrections = !this.dataService.corrections
        //   ? null
        //   : this.dataService.corrections.filter(
        //     correction => correction.tpGroup === repository.tpGroup
        //   );
        const pointBackgroundColor = [];
        const borderColor = "rgba(77, 77, 77, 0.5)";
        labels.push(repository.name);
        repository.commits &&
          repository.commits.forEach((commit) => {
            // commit.updateMetadata(
            //   reviews,
            //   corrections,
            //   this.dataService.questions
            // );
            if (
              !this.searchFilter.length ||
              this.searchFilter.includes(commit.question)
            ) {
              data.push({
                x: commit.commitDate,
                y: repository.name,
                commit,
              });
              pointStyle.push(this.getPointStyle(commit));
              pointBackgroundColor.push(commit.color.color);
            }
          });
        chartData.push({
          data,
          pointStyle,
          pointBackgroundColor,
          borderColor,
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
      window.open(data.commit.url, "_blank");
    } else {
      const rawDate = this.getValueFromEvent(event);
      this.showAddMilestoneModal(rawDate);
    }
  }

  showAddMilestoneModal(date) {
    this.dateModal = date.format("YYYY-MM-DDTHH:mm");
    this.labelModal = "";
    this.tpGroupModal = "";
    this.questionsModal = [];
    this.typeModal = "";
    this.addModal = true;
    this.showModal();
  }

  showEditMilestoneModal(milestone: Milestone) {
    this.dateModal = moment(milestone.date).format("YYYY-MM-DDTHH:mm");
    this.labelModal = milestone.label;
    this.tpGroupModal = milestone.tpGroup;
    this.questionsModal = milestone.questions ? milestone.questions : [];
    this.typeModal = milestone.type;
    this.addModal = false;
    this.savedMilestoneModal = milestone;
    this.showModal();
  }

  showModal() {
    $("#addMilestoneModal").modal("show");
  }

  getValueFromEvent(event) {
    const xAxis = this.myChart.chart.scales["x-axis-0"];
    const x = event.event.offsetX;
    return xAxis.getValueForPixel(x);
  }

  onChartHover(event) {
    const data = this.getDataFromChart(event);
  }

  onSubmit(form: NgForm) {
    const questions = form.value.questions;

    const jalon = new Milestone(
      new Date(form.value.date),
      form.value.label.trim(),
      questions.length ? questions : null,
      (form.value.tpGroup || "").trim(),
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

    this.dataService.saveData();

    form.resetForm({
      date: "",
      label: "",
      questions: [],
      tpGroup: "",
      jalon: "",
    });

    this.loadGraphMetadata(
      this.dataService.repositories,
      this.dataService.reviews,
      this.dataService.corrections,
      this.dataService.questions
    );
    this.dispose();
    let translations = this.translateService.instant([
      "SUCCESS",
      "MILESTONE-SAVED",
    ]);
    this.toastService.success(
      translations["SUCCESS"],
      translations["MILESTONE-SAVED"]
    );
  }

  deleteMilestone() {
    this.dataService[this.savedMilestoneModal.type].splice(
      this.dataService[this.savedMilestoneModal.type].indexOf(
        this.savedMilestoneModal
      ),
      1
    );

    this.dataService.saveData();

    this.loadGraphMetadata(
      this.dataService.repositories,
      this.dataService.reviews,
      this.dataService.corrections,
      this.dataService.questions
    );
    this.dispose();
    let translations = this.translateService.instant([
      "SUCCESS",
      "MILESTONE-DELETED",
    ]);
    this.toastService.success(
      translations["SUCCESS"],
      translations["MILESTONE-DELETED"]
    );
  }

  deleteElement(element, list) {
    list.splice(list.indexOf(element), 1).slice();
  }

  selectUnit(unit: string) {
    this.unit = unit;
    this.myChart.chart.options.scales.xAxes[0].time.unit = unit;
    this.myChart.chart.update();
  }

  changeUnit() {
    if (this.unit === "week") {
      this.selectUnit("day");
    } else if (this.unit === "day") {
      this.selectUnit("hour");
    } else if (this.unit === "hour") {
      this.selectUnit("week");
    }
  }

  getPointStyle(commit: Commit) {
    if (commit.isCloture) {
      return "circle";
    } else {
      return "rectRot";
    }
  }

  getDataFromChart(event) {
    const datasetIndex = event.active[0]._datasetIndex;
    const dataIndex = event.active[0]._index;
    return this.chartData[datasetIndex].data[dataIndex];
  }

  getDataFromFile(text) {
    this.dataService.repositories = text.repositories
      .filter((repository) =>
        repository.url.match(/https:\/\/github.com\/[^\/]*\/[^\/]*/)
      )
      .map((repository) => Repository.withJSON(repository));
    if (text.repositories.length !== this.dataService.repositories.length) {
      let translations = this.translateService.instant([
        "ERRORS.WARNING",
        "ERRORS.INVALID-URLS",
      ]);
      this.toastService.warning(
        translations["ERRORS.WARNING"],
        translations["ERRORS.INVALID-URLS"]
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
      ? text.corrections.map((data) => Milestone.withJSON(data, "corrections"))
      : undefined;
    this.dataService.sessions = text.sessions
      ? text.sessions.map((data) => Session.withJSON(data))
      : undefined;
    this.dataService.reviews = text.reviews
      ? text.reviews.map((data) => Milestone.withJSON(data, "reviews"))
      : undefined;
    this.dataService.others = text.others
      ? text.others.map((data) => Milestone.withJSON(data, "others"))
      : undefined;
  }

  @HostListener("window:keyup", ["$event"])
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
    $("#addMilestoneModal").modal("hide");
  }

  searchSubmit(form: NgForm) {
    this.searchFilter = form.value.search;
    this.loadGraphDataAndRefresh();
  }

  adaptScaleWithChart(chart) {
    let min = new Date(chart.scales["x-axis-0"].min);
    let max = new Date(chart.scales["x-axis-0"].max);
    this.adaptScale(min, max);
  }

  adaptScale(min, max) {
    let distance = (max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24);

    if (this.unit === "day") {
      if (Math.round(distance) > 7) {
        this.selectUnit("week");
      } else if (Math.floor(distance) < 1) {
        this.selectUnit("hour");
      }
    } else if (this.unit === "week") {
      if (Math.round(distance) < 9) {
        this.selectUnit("day");
      }
    } else if (this.unit === "hour") {
      if (Math.round(distance) > 1) {
        this.selectUnit("day");
      }
    }
  }

  download() {
    this.dataService.generateJSON();
    let colors = [
      CommitColor.BEFORE,
      CommitColor.BETWEEN,
      CommitColor.AFTER,
      CommitColor.NOCOMMIT,
    ];
    let shortFilenameTab = this.jsonManager.filename.split(".");
    shortFilenameTab.pop();
    let shortFilename = shortFilenameTab.join(".");

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
    questionsDict["date"] = this.dataService.lastUpdateDate;

    colors = [
      CommitColor.INTERMEDIATE,
      CommitColor.BEFORE,
      CommitColor.BETWEEN,
      CommitColor.AFTER,
    ];

    let studentsDict = {
      date: this.dataService.lastUpdateDate,
      students: this.commitsService.loadStudentsDict(
        this.dataService.repositories,
        this.dataService.questions,
        colors
      ),
    };

    let zip = new JSZip();
    zip.file(
      this.jsonManager.filename,
      JSON.stringify(this.jsonManager.json, null, 2)
    );
    zip.file(
      "questions-completion.json",
      JSON.stringify(questionsDict, null, 2)
    );
    zip.file("students-commits.json", JSON.stringify(studentsDict, null, 2));

    zip.generateAsync({ type: "blob" }).then(function (content) {
      saveAs(content, shortFilename + ".zip");
    });
  }

  verifyJSON(json) {
    let regex =
      "([0-9]{4}-[0-1]?[0-9]-[0-3]?[0-9] [0-2]?[0-9]:[0-5][0-9])|([0-9]{4}-[0-1]?[0-9]-[0-3]?[0-9]T[0-2]?[0-9]:[0-5][0-9](:[0-5][0-9])?(.[0-9]{3}Z?)?)";
    let schema = {
      properties: {
        title: {
          type: "string",
        },
        course: {
          type: "string",
        },
        program: {
          type: "string",
        },
        year: {
          type: "string",
        },
        startDate: {
          type: "string",
          pattern: regex,
        },
        endDate: {
          type: "string",
          pattern: regex,
        },
        questions: {
          type: "array",
          uniqueItems: true,
          items: {
            type: "string",
          },
        },
        repositories: {
          type: "array",
          uniqueItems: true,
          minItems: 1,
          items: {
            properties: {
              url: {
                type: "string",
                format: "uri",
              },
              name: {
                type: "string",
              },
              tpGroup: {
                type: "string",
              },
            },
            required: ["url"],
          },
        },
        sessions: {
          type: "array",
          uniqueItems: true,
          items: {
            properties: {
              startDate: {
                type: "string",
                pattern: regex,
              },
              endDate: {
                type: "string",
                pattern: regex,
              },
              tpGroup: {
                type: "string",
              },
            },
            required: ["startDate", "endDate"],
          },
        },
        reviews: {
          type: "array",
          uniqueItems: true,
          items: {
            properties: {
              date: {
                type: "string",
                pattern: regex,
              },
              label: {
                type: "string",
              },
              tpGroup: {
                type: "string",
              },
              questions: {
                type: "array",
                uniqueItems: true,
                items: {
                  type: "string",
                },
              },
            },
            required: ["date"],
          },
        },
        corrections: {
          type: "array",
          uniqueItems: true,
          items: {
            properties: {
              date: {
                type: "string",
                pattern: regex,
              },
              label: {
                type: "string",
              },
              tpGroup: {
                type: "string",
              },
              questions: {
                type: "array",
                uniqueItems: true,
                items: {
                  type: "string",
                },
              },
            },
            required: ["date"],
          },
        },
        others: {
          type: "array",
          uniqueItems: true,
          items: {
            properties: {
              date: {
                type: "string",
                pattern: regex,
              },
              label: {
                type: "string",
              },
              tpGroup: {
                type: "string",
              },
              questions: {
                type: "array",
                uniqueItems: true,
                items: {
                  type: "string",
                },
              },
            },
            required: ["date"],
          },
        },
      },
      required: ["title", "questions", "repositories"],
    };

    let ajv = new Ajv({ $data: true, allErrors: true, verbose: true });
    let valid = ajv.validate(schema, json);

    if (!valid) {
      let errorMessage =
        "&emsp;" +
        ajv.errors
          .map((error) => {
            return error.dataPath + " " + error.message;
          })
          .join("<br>&emsp;");
      this.toastService.error(
        this.translateService.instant("INVALID-CONF-FILE"),
        errorMessage
      );

      return false;
    }

    return true;
  }
}
