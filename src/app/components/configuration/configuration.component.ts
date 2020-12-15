import { Component, OnInit } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { DataService } from "@services/data.service";
import { ToastService } from "@services/toast.service";

@Component({
  templateUrl: "./configuration.component.html",
  styleUrls: ["./configuration.component.scss"],
})
export class ConfigurationComponent implements OnInit {
  metadataModified: boolean;
  repositoriesModified: boolean;
  sessionsModified: boolean;

  constructor(
    public translateService: TranslateService,
    public dataService: DataService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.metadataModified = false;
    this.repositoriesModified = false;
    this.sessionsModified = false;
  }

  get isModified() {
    return (
      this.metadataModified ||
      this.repositoriesModified ||
      this.sessionsModified
    );
  }

  saveMetadata(metadata) {
    this.dataService.title = metadata.title;
    this.dataService.course = metadata.course;
    this.dataService.program = metadata.program;
    this.dataService.year = metadata.year;
    this.dataService.startDate = metadata.startDate;
    this.dataService.endDate = metadata.endDate;
    this.dataService.questions = metadata.questions;

    this.metadataModified = false;

    this.dataService.saveData();

    this.successToast();
  }

  saveRepositories(repositories) {
    this.dataService.repositories = repositories;

    this.repositoriesModified = false;

    this.dataService.saveData();

    this.successToast();
  }

  saveSessions(sessions) {
    this.dataService.sessions = sessions;

    this.sessionsModified = false;

    this.dataService.saveData();

    this.successToast();
  }

  successToast() {
    let translations = this.translateService.instant([
      "SUCCESS",
      "SUCCESS-MESSAGE",
    ]);
    this.toastService.success(
      translations["SUCCESS"],
      translations["SUCCESS-MESSAGE"]
    );
  }
}
