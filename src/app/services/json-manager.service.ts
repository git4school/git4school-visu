import { Injectable } from "@angular/core";
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
  constructor() {}

  readFile(file: Blob): Promise<any> {
    return file.text().then((text) => {
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        json = Promise.reject("File could not be read");
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
