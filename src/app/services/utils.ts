import * as moment from "moment";

export class Utils {
  static readonly DEFAULT_TP_GROUP = "1";
  static readonly DATE_FORMAT =
    "([0-9]{4}-[0-1]?[0-9]-[0-3]?[0-9] [0-2]?[0-9]:[0-5][0-9])|([0-9]{4}-[0-1]?[0-9]-[0-3]?[0-9]T[0-2]?[0-9]:[0-5][0-9](:[0-5][0-9])?(.[0-9]{3}Z?)?)";
  
  static getTimeFromDate(date: Date) {
    return date ? {
      hour: moment(date).hour(),
      minute: moment(date).minutes(),
    } : null;
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
