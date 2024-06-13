import { NgbTimeStruct } from "@ng-bootstrap/ng-bootstrap";
import * as moment from "moment";

export class Utils {
  static readonly DEFAULT_SESSION_DURATION = {
    hour: 1,
    minute: 30,
    second: 0,
  };
  static readonly DEFAULT_TP_GROUP = "1";
  static readonly DATE_FORMAT =
    "([0-9]{4}-[0-1]?[0-9]-[0-3]?[0-9] [0-2]?[0-9]:[0-5][0-9])|([0-9]{4}-[0-1]?[0-9]-[0-3]?[0-9]T[0-2]?[0-9]:[0-5][0-9](:[0-5][0-9])?(.[0-9]{3}Z?)?)";

  static readonly SLIDER_STEP = 86400000;
  static readonly OVERVIEW_NAME_LENGTH_LIMIT = 20;
  static readonly COMMIT_DATE_FORMAT = (date: Date) =>
    date.toLocaleDateString(undefined, { hour12: false, hour: "2-digit" });

  static getTimeFromDate(date: Date) {
    return date
      ? {
          hour: moment(date).hour(),
          minute: moment(date).minutes(),
        }
      : null;
  }

  static addTimeToDate(date: Date, time: NgbTimeStruct): Date {
    let updatedDate = new Date(date);
    updatedDate.setHours(updatedDate.getHours() + time.hour);
    updatedDate.setMinutes(updatedDate.getMinutes() + time.minute);
    updatedDate.setSeconds(updatedDate.getSeconds() + time.second);
    return updatedDate;
  }

  static addTimeToTime(time1: NgbTimeStruct, time2: NgbTimeStruct) {
    const date = moment(new Date()).set(time1).toDate();
    return this.getTimeFromDate(this.addTimeToDate(date, time2));
  }

  /**
   * Returns a date interval to be used by sliders or other components to adjust their data with list of commits
   *
   * @param values A list of values which can be mapped to date
   * @param mapper The mapper from type T to date
   * @returns An interval where [0] is older date and [1] is the newest (both undefined if list is empty)
   */
  static getTimeInterval<T>(values: T[], mapper: (v: T) => Date): [Date, Date] {
    let dates = values.map(mapper);
    if (dates.length == 0) return [undefined, undefined];

    return dates.reduce(
      (interval, date) => [
        new Date(Math.min(interval[0].getTime(), date.getTime())),
        new Date(Math.max(interval[1].getTime(), date.getTime())),
      ],
      [dates[0], dates[1]]
    );
  }

  static CONF_FILE_JSON_SCHEMA = {
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
        pattern: Utils.DATE_FORMAT,
      },
      endDate: {
        type: "string",
        pattern: Utils.DATE_FORMAT,
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
              pattern: Utils.DATE_FORMAT,
            },
            endDate: {
              type: "string",
              pattern: Utils.DATE_FORMAT,
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
              pattern: Utils.DATE_FORMAT,
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
              pattern: Utils.DATE_FORMAT,
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
              pattern: Utils.DATE_FORMAT,
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
  constructor() {}
}
