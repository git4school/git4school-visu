/* eslint-disable max-len */
import { NgbTimeStruct } from "@ng-bootstrap/ng-bootstrap";
import * as moment from "moment";

const eventSchema = {
  type: "array",
  uniqueItems: true,
  items: {
    properties: {
      date: {
        type: "string",
        pattern:
          // eslint-disable-next-line max-len
          "([0-9]{4}-[0-1]?[0-9]-[0-3]?[0-9] [0-2]?[0-9]:[0-5][0-9])|([0-9]{4}-[0-1]?[0-9]-[0-3]?[0-9]T[0-2]?[0-9]:[0-5][0-9](:[0-5][0-9])?(.[0-9]{3}Z?)?)",
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
};

export class Utils {
  static readonly DEFAULT_SESSION_DURATION = {
    hour: 1,
    minute: 30,
    second: 0,
  };
  static readonly DEFAULT_TP_GROUP = "1";
  static readonly DATE_FORMAT =
    // eslint-disable-next-line max-len
    "([0-9]{4}-[0-1]?[0-9]-[0-3]?[0-9] [0-2]?[0-9]:[0-5][0-9])|([0-9]{4}-[0-1]?[0-9]-[0-3]?[0-9]T[0-2]?[0-9]:[0-5][0-9](:[0-5][0-9])?(.[0-9]{3}Z?)?)";

  static readonly SLIDER_STEP = 86400000;
  static readonly OVERVIEW_NAME_LENGTH_LIMIT = 20;
  static readonly COMMIT_FUSE_RANGE = 15;
  static readonly CONF_FILE_JSON_SCHEMA = {
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
      reviews: eventSchema,
      corrections: eventSchema,
      others: eventSchema,
    },
    required: ["title", "questions", "repositories"],
  };

  static readonly LAST_NAME_TOKENS = ["Nom", "Last name", "Last-name", "Lastname", "Surname", "Family name", "Фамилия"];

  static readonly FIRST_NAME_TOKENS = ["Prénom", "Prenom", "First name", "First-name", "Firstname", "Given name", "Forename", "Имя"];

  constructor() {}

  static readonly COMMIT_DATE_FORMAT = (date: Date) => {
    if (!date) {
      return "";
    }
    const d = date instanceof Date ? date : new Date(date);
    const options: Intl.NumberFormatOptions = {
      useGrouping: false,
      minimumIntegerDigits: 2,
    };

    let year = d.getFullYear().toLocaleString(undefined, options);
    let month = (d.getMonth() + 1).toLocaleString(undefined, options);
    let day = d.getDate().toLocaleString(undefined, options);
    let hour = d.getHours().toLocaleString(undefined, options);
    let minute = d.getMinutes().toLocaleString(undefined, options);
    let seconds = d.getSeconds().toLocaleString(undefined, options);

    return `${day}/${month}/${year} ${hour}:${minute}:${seconds}`;
  };

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
      [dates[0], dates[1]],
    );
  }

  static getCssVariable(variableName: string): string {
    if (!variableName) return variableName;
    let varName = variableName.trim();
    if (varName.startsWith("var(")) {
      varName = varName.substring(4, varName.length - 1).trim();
    }
    if (varName.startsWith("--")) {
      return getComputedStyle(document.body).getPropertyValue(varName).trim() || variableName;
    }
    return variableName;
  }
  static truncateMiddle(str: string, maxLength: number): string {
    if (!str || str.length <= maxLength) return str;
    const charsToShow = Math.max(1, maxLength - 3);
    const frontChars = Math.ceil(charsToShow / 2);
    const backChars = Math.floor(charsToShow / 2);
    return str.substring(0, frontChars) + "..." + str.substring(str.length - backChars);
  }

  /**
   * Extracts the normalized core assignment identifier from a repository or assignment name.
   * Strips owner prefix, template/squelette suffixes, and normalizes delimiters to hyphens.
   *
   * Example:
   * "ue-toaw-tp_m2sdl_2024_friendsofmine-M2_2024_FriendsOfMine_squelette", owner "UE-TOAW"
   * => "tp-m2sdl-2024-friendsofmine"
   */
  static extractAssignmentCore(name: string, owner?: string): string {
    if (!name) return "";
    let clean = name.trim();
    if (owner) {
      clean = clean.replace(new RegExp(`^${owner}[-_]`, "i"), "");
    }
    clean = clean.replace(/[-_][a-zA-Z0-9_]*(?:squelette|template|skeleton)[a-zA-Z0-9_]*$/i, "");
    clean = clean.replace(/[-_](?:squelette|template|skeleton)[a-zA-Z0-9_]*$/i, "");
    clean = clean.replace(/[-_]+$/, "");
    return clean.replace(/_/g, "-").toLowerCase();
  }

  static getValueWithToken(token: string, text: string): string {
    if (!token || !text) return null;
    let regex = new RegExp(`(?<=${token}).*`);
    let value = text.match(regex);
    return value ? value[0].trim() : null;
  }

  static getValueWithTokenFlexible(token: string, text: string): string {
    if (!token || !text) return null;
    const lines = text.split(/\r?\n/);
    const escapedToken = token.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const pattern = new RegExp(
      `^[ \\t]*(?:[-*+]|[0-9]+\\.)?[ \\t]*(?:\\*\\*|#{1,6}|_|\\*)*[ \\t]*${escapedToken}[ \\t]*(?:[:\\-]?[ \\t]*)?(?:\\*\\*|#{1,6}|_|\\*)*[ \\t]*[:\\-]?[ \\t]*(.*)$`,
      "i",
    );

    for (const rawLine of lines) {
      const match = rawLine.match(pattern);
      if (match && match[1] !== undefined) {
        let val = match[1].trim();
        val = val.replace(/^[:\\-]+/, "").trim();
        val = val.replace(/^[*_#]+|[*_#]+$/g, "").trim();
        if (val && !/^(?:#{1,6}|\*\*|__)/.test(val)) {
          return val;
        }
      }
    }
    return null;
  }

  static getNameFromIdentity(identity: any): string {
    if (!identity) return "";
    return [identity.last_name, identity.first_name].filter(Boolean).join(" ");
  }

  static getNameFromReadMe(readme: string, lastNameToken?: string, firstNameToken?: string): string {
    if (!readme) return null;

    let lastName: string = null;
    let firstName: string = null;

    if (lastNameToken && firstNameToken) {
      lastName = this.getValueWithToken(`${lastNameToken}.*:`, readme);
      firstName = this.getValueWithToken(`${firstNameToken}.*:`, readme);
      if (lastName || firstName) {
        return [lastName, firstName].filter(Boolean).join(" ");
      }
    }

    for (const token of this.LAST_NAME_TOKENS) {
      const val = this.getValueWithTokenFlexible(token, readme);
      if (val) {
        lastName = val;
        break;
      }
    }

    for (const token of this.FIRST_NAME_TOKENS) {
      const val = this.getValueWithTokenFlexible(token, readme);
      if (val) {
        firstName = val;
        break;
      }
    }

    if (lastName || firstName) {
      return [lastName, firstName].filter(Boolean).join(" ");
    }

    return null;
  }

  static getTPGroupFromReadMe(readme: string): string {
    if (!readme) return null;
    const match = /(?:^|[\r\n]+)[ \t]*-[ \t]*\[[xX]\][ \t]*([^\r\n]+)/.exec(readme);
    if (match && match[1]) {
      return match[1].trim();
    }
    return null;
  }

  /**
   * Unified extraction of student name and TP group from raw IDENTITY.json and/or README.md.
   * Priority: IDENTITY.json > multilingual README.md.
   */
  static extractRepositoryMetadata(identityData?: string, readmeData?: string): { name: string; tpGroup: string } {
    let name = "";
    let tpGroup = "";

    if (identityData) {
      try {
        const parsed = JSON.parse(identityData);
        name = this.getNameFromIdentity(parsed);
        tpGroup = parsed.group || "";
      } catch (e) {}
    }

    if (!name && readmeData) {
      const readmeName = this.getNameFromReadMe(readmeData);
      if (readmeName) {
        name = readmeName;
      }
    }

    if (!tpGroup && readmeData) {
      const readmeGroup = this.getTPGroupFromReadMe(readmeData);
      if (readmeGroup) {
        tpGroup = readmeGroup;
      }
    }

    return { name, tpGroup };
  }
}
