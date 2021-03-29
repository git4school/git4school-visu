import { Injectable } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { saveAs } from "file-saver";

/**
 * This service manages the configuration file
 */
@Injectable({
  providedIn: "root",
})
export class JsonManagerService {
  /**
   * JsonManagerService constructor
   */
  constructor(private translateService: TranslateService) {}

  readFile(file: Blob): Promise<any> {
    return file.text().then((text) => {
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        json = Promise.reject(
          this.translateService.instant("ERROR-CANNOT-READ-FILE")
        );
      }
      return json;
    });
  }

  saveJsonFile(json: any, filename: string) {
    let blob = new Blob([JSON.stringify(json, null, 2)], {
      type: "application/json",
    });

    saveAs(blob, filename + ".json");
  }
}
