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

  static readonly OVERVIEW_NAME_LENGTH_LIMIT = 20;

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
