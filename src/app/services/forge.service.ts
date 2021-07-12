import { Injectable } from "@angular/core";
import { ForgeConnector } from "@services/forge-connector";

@Injectable({
  providedIn: "root",
})
export class ForgeService {
  forgeConnector: ForgeConnector;

  constructor() {}

  setForgeConnector(forgeConnector: ForgeConnector) {
    this.forgeConnector = forgeConnector;
  }
}
