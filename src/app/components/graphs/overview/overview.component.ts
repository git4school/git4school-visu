import {
  AfterViewInit,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import { FileChooserComponent } from "@components/file-chooser/file-chooser.component";
import { OverviewGraphContextualMenuComponent } from "@components/overview-graph-contextual-menu/overview-graph-contextual-menu.component";
import { Commit } from "@models/Commit.model";
import { Milestone } from "@models/Milestone.model";
import { Session } from "@models/Session.model";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { TranslateService, TranslationChangeEvent } from "@ngx-translate/core";
import { AssignmentsService } from "@services/assignments.service";
import { DataService } from "@services/data.service";
import { JsonManagerService } from "@services/json-manager.service";
import { LoaderService } from "@services/loader.service";
import { ToastService } from "@services/toast.service";
import { BaseChartDirective } from "ng2-charts";
import { Subscription } from "rxjs";
import { BaseGraphComponent } from "../base-graph.component";

@Component({
  selector: "overview",
  templateUrl: "./overview.component.html",
  styleUrls: ["./overview.component.scss"],
})
export class OverviewComponent
  extends BaseGraphComponent
  implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(BaseChartDirective, { static: true }) myChart;
  @ViewChild(OverviewGraphContextualMenuComponent) contextualMenu;

  contextualMenuShown: boolean;

  assignmentsModified$: Subscription;

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
      events: ["click", "enter", "leave"],
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

  constructor(
    private translateService: TranslateService,
    private toastService: ToastService,
    public jsonManager: JsonManagerService,
    public dataService: DataService,
    protected loaderService: LoaderService,
    private modalService: NgbModal,
    protected assignmentsService: AssignmentsService
  ) {
    super(loaderService, assignmentsService, dataService);
  }

  @HostListener("window:keyup", ["$event"])
  keyEvent(event: KeyboardEvent) {
    if (event.keyCode === 32) {
      this.resetZoom();
    }
  }

  ngOnInit(): void {
    this.contextualMenuShown = false;
    this.assignmentsModified$ = this.subscribeAssignmentModified();
    this.updateLang();
    this.translateService.onLangChange.subscribe(
      (event: TranslationChangeEvent) => {
        this.updateLang();
      }
    );
  }

  ngOnDestroy(): void {
    this.unsubscribeAssignmentModified(this.assignmentsModified$);
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

  isContextualMenuShown() {
    return this.contextualMenu.isContextMenuOpen();
  }

  openEditMilestoneContextMenu(
    review: Milestone,
    x: number,
    y: number,
    date: Date
  ) {
    this.contextualMenu.close();
    this.contextualMenu.openEditMilestone(review, x, y, date);
  }

  openEditSessionContextMenu(
    session: Session,
    x: number,
    y: number,
    date: Date
  ) {
    this.contextualMenu.close();
    this.contextualMenu.openEditSession(session, x, y, date);
  }

  openContextMenu(x: number, y: number, date: Date) {
    if (!this.isContextualMenuShown()) {
      this.contextualMenu.openNew(x, y, date);
    }
  }

  onSaveMilestone(result: {
    oldMilestone: Milestone;
    newMilestone: Milestone;
  }) {
    try {
      if (result.newMilestone) {
        this.dataService[result.newMilestone.type].push(result.newMilestone);
      }

      if (result.oldMilestone) {
        this.dataService[result.oldMilestone.type].splice(
          this.dataService[result.oldMilestone.type].indexOf(
            result.oldMilestone
          ),
          1
        );
      }

      this.saveData();

      let translations = this.translateService.instant([
        "SUCCESS",
        "MILESTONE-SAVED",
        "MILESTONE-DELETED",
      ]);
      this.toastService.success(
        translations["SUCCESS"],
        result.newMilestone
          ? translations["MILESTONE-SAVED"]
          : translations["MILESTONE-DELETED"]
      );
    } catch (e) {
      // toast fail
    }
  }

  onSaveSession(result: { oldMilestone: Milestone; newMilestone: Milestone }) {}

  onDeleteSession(session: Session) {
    // this.deleteSession(session);
  }

  onDeleteMilestone(milestone: Milestone) {
    this.deleteMilestone(milestone);
  }

  loadSessions() {
    let me = this;
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
          onClick: function (e) {
            const rawDate = me.getDateFromEvent(e);
            me.openEditSessionContextMenu(session, e.pageX, e.pageY, rawDate);
          },
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
            const rawDate = me.getDateFromEvent(e);
            me.openEditMilestoneContextMenu(review, e.pageX, e.pageY, rawDate);
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
            const rawDate = me.getDateFromEvent(e);
            me.openEditMilestoneContextMenu(
              correction,
              e.pageX,
              e.pageY,
              rawDate
            );
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
            const rawDate = me.getDateFromEvent(e);
            me.openEditMilestoneContextMenu(other, e.pageX, e.pageY, rawDate);
          },
        });
      });
  }

  loadPoints() {
    const chartData = [];
    const labels = [];

    this.dataService.repositories
      .filter(
        (repository) => !this.tpGroup || repository.tpGroup === this.tpGroup
      )
      .forEach((repository) => {
        const data = [];
        const pointStyle = [];
        const pointBackgroundColor = [];
        const borderColor = "rgba(77, 77, 77, 0.5)";
        labels.push(repository.name);
        repository.commits &&
          repository.commits.forEach((commit) => {
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

  onChartClick(event) {
    if (event.active.length > 0) {
      const data = this.getDataFromChart(event);
      window.open(data.commit.url, "_blank");
    } else {
      const rawDate = this.getDateFromEvent(event.event);
      setTimeout(() => {
        this.openContextMenu(event.event.pageX, event.event.pageY, rawDate);
      });
    }
  }

  getDateFromEvent(event) {
    const xAxis = this.myChart.chart.scales["x-axis-0"];
    const x = event.offsetX;
    return xAxis.getValueForPixel(x);
  }

  onChartHover(event) {
    const data = this.getDataFromChart(event);
  }

  deleteMilestone(milestone: Milestone) {
    this.dataService[milestone.type].splice(
      this.dataService[milestone.type].indexOf(milestone),
      1
    );

    this.saveData();

    let translations = this.translateService.instant([
      "SUCCESS",
      "MILESTONE-DELETED",
    ]);
    this.toastService.success(
      translations["SUCCESS"],
      translations["MILESTONE-DELETED"]
    );
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

  searchSubmit() {
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

  openUploadFileModal() {
    let modalReference = this.modalService.open(FileChooserComponent, {});
    modalReference.result.then((assignment) => {
      assignment.id = this.dataService.assignment.id;
      this.dataService.assignment = assignment;
      this.dataService.saveData();
      this.loadGraph();
    });
  }

  private saveData() {
    this.dataService.saveData();

    this.loadGraphMetadata(
      this.dataService.repositories,
      this.dataService.reviews,
      this.dataService.corrections,
      this.dataService.questions
    );
  }
}
