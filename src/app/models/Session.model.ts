import { Type } from "class-transformer";
import * as moment from "moment";

/**
 * This class modelizes a practical session
 */
export class Session {
  @Type(() => Date)
  public startDate: Date;

  @Type(() => Date)
  public endDate: Date;

  /**
   * Session constructor
   * @param startDate The date from which the session begins
   * @param endDate The date on which the session ends
   * @param tpGroup The associated tp group
   */
  constructor(startDate: Date, endDate: Date, public tpGroup?: string) {
    this.startDate = moment(startDate).toDate();
    this.endDate = moment(endDate).toDate();
  }

  /**
   * Initialize a Session from the json configuration file
   * @param json The json configuration file
   * @returns A session
   */
  static withJSON(json): Session {
    return new Session(json.startDate, json.endDate, json.tpGroup);
  }

  /**
   * Returns a json view of the session
   * @returns A json view of the session
   */
  json() {
    let json = {
      startDate: moment(this.startDate).toISOString(),
      endDate: moment(this.endDate).toISOString(),
    };
    if (this.tpGroup) {
      json["tpGroup"] = this.tpGroup;
    }
    return json;
  }
}
