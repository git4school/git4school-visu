import { Type } from "class-transformer";
import * as moment from "moment";

/**
 * This class modelizes a milestone which can be : a "review", a "correction" or an "other" milestone
 */
export class Milestone {
  @Type(() => Date)
  public date: Date;

  /**
   * Milestone constructor
   * @param date The date on which the milestone takes place
   * @param label The milestone name
   * @param questions The questions covered by the milestone
   * @param tpGroup The TP group associated with the milestone
   * @param type The type of the milestone (review, correction, other)
   */
  constructor(
    date: Date,
    public label: string,
    public questions?: string[],
    public tpGroup?: string,
    public type?: string,
    public notes?: string,
  ) {
    this.date = moment(date).toDate();
  }

  /**
   * Initialize a Milestone from the json configuration file
   * @param json The json configuration file
   * @param type The type of the milestone as a string (review, correction, other)
   * @returns A Milestone
   */
  static withJSON(json, type): Milestone {
    return new Milestone(
      json.date,
      json.label,
      json.questions,
      json.tpGroup,
      type,
      json.notes,
    );
  }

  /**
   * Returns a json view of the milestone
   * @returns A json view of the milestone
   */
  json() {
    let json = {
      date: moment(this.date).toISOString(),
      label: this.label,
      questions: this.questions,
    };
    if (this.tpGroup) {
      json["tpGroup"] = this.tpGroup;
    }

    if (this.notes) {
      json["notes"] = this.notes;
    }

    return json;
  }
}
