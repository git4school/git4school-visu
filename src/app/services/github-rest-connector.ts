import { ForgeConnector } from "@services/forge-connector";

export class GithubRESTConnector implements ForgeConnector {
  authenticate() {
    throw new Error("Method not implemented.");
  }
}
