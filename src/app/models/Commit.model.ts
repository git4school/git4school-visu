import { Milestone } from "@models/Milestone.model";
import { QuestionClosingMode } from "@models/Metadata.model";
import { Type } from "class-transformer";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A constant containing the possible types of commits and their corresponding color and label
 */
export const CommitColor = {
  BEFORE: {
    label: "Before review",
    labelKey: "OVERVIEW-GRAPH.LEGEND.BEFORE",
    name: "green",
    color: "var(--color-success)",
  },
  BETWEEN: {
    label: "Between review and correction",
    labelKey: "OVERVIEW-GRAPH.LEGEND.BETWEEN",
    name: "orange",
    color: "var(--color-warning)",
  },
  AFTER: {
    label: "After correction",
    labelKey: "OVERVIEW-GRAPH.LEGEND.AFTER",
    name: "red",
    color: "var(--color-danger)",
  },
  INTERMEDIATE: {
    label: "Intermediate commit",
    labelKey: "OVERVIEW-GRAPH.LEGEND.INTERMEDIATE",
    name: "slate",
    color: "var(--color-commit-intermediate)",
  },
  NOCOMMIT: {
    label: "Not finished",
    labelKey: "OVERVIEW-GRAPH.LEGEND.NOCOMMIT",
    name: "muted",
    color: "var(--color-border)",
  },
};

/**
 * This class modelizes a commit from GitHub, with only useful informations
 */
export class Commit {
  @Type(() => Date)
  public commitDate: Date;

  /**
   * Commit constructor
   * @param message The commit message
   * @param author The commit author
   * @param commitDate The commit date
   * @param url The GitHub URL of the commit
   * @param isEnSeance A boolean, true if the commit has been done during the corresponding session
   * @param isCloture A boolean, true if the commit closes a question
   * @param question The corresponding question if there is one
   * @param color The corresponding color of the commit depending on its date and on the corresponding milestones
   */
  constructor(
    public message: string,
    public author: string,
    commitDate: Date,
    public url: string,
    public isEnSeance = false,
    public isCloture = false,
    public question?: string,
    public color = CommitColor.INTERMEDIATE,
  ) {
    this.commitDate = new Date(commitDate);
  }

  /**
   * Initialize a Commit from the its attributes
   * @param message The commit message
   * @param author The commit author
   * @param commitDate The commit date
   * @param url The GitHub URL of the commit
   * @param isEnSeance A boolean, true if the commit has been done during its corresponding session
   * @param isCloture A boolean, true if the commit closes a question
   * @param question The corresponding question, found by its message
   * @returns A commit
   */
  static withAttributes(
    message: string,
    author: string,
    commitDate: Date,
    url: string,
    isEnSeance?: boolean,
    isCloture?: boolean,
    question?: string,
  ): Commit {
    return new Commit(message, author, commitDate, url, isEnSeance, isCloture, question);
  }

  /**
   * Initialize a Commit from the json configuration file
   * @param json The json configuration file
   * @returns A commit
   */
  static withJSON(json): Commit {
    return new Commit(json.commit.message, json.commit.committer.name, json.commit.committer.date, json.html_url);
  }

  /**
   * Initialize a Commit from the GraphQL JSON object
   * @param json The GraphQL JSON node
   * @returns A commit
   */
  static withGraphQLJSON(json): Commit {
    return new Commit(
      json.message,
      json.author?.name || "Unknown",
      json.committedDate ? new Date(json.committedDate) : new Date(),
      json.url,
    );
  }

  /**
   * Updates the isEnSeance variable
   * @param startDate The date before which commits are not processed
   * @param endDate The date after which commits are not processed
   */
  updateIsEnSeance(startDate: Date, endDate: Date) {
    if (this.commitDate.getTime() >= startDate.getTime() && this.commitDate.getTime() <= endDate.getTime()) {
      this.isEnSeance = true;
    } else {
      this.isEnSeance = false;
    }
  }

  /**
   * Updates the commits metadata, corresponding to : isCloture, question, color and commitDate
   * @param reviews The reviews to handle
   * @param corrections The corrections to handle
   * @param questions The questions to handle
   * @param closingMode The strategy for question closing commits detection
   * @param customClosingKeywords Custom keywords when closingMode is 'custom'
   */
  updateMetadata(
    reviews: Milestone[],
    corrections: Milestone[],
    questions: string[],
    closingMode: QuestionClosingMode = "standard",
    customClosingKeywords: string[] = [],
  ) {
    this.updateQuestion(questions, closingMode, customClosingKeywords);
    this.updateIsCloture(closingMode, customClosingKeywords);
    this.updateColor(reviews, corrections);
  }

  /**
   * Updates the isCloture variable
   * @param closingMode The strategy for question closing commits detection
   * @param customClosingKeywords Custom keywords when closingMode is 'custom'
   */
  updateIsCloture(closingMode: QuestionClosingMode = "standard", customClosingKeywords: string[] = []) {
    if (!this.message) {
      this.isCloture = false;
      return;
    }

    if (closingMode === "none") {
      this.isCloture = Boolean(this.question);
      return;
    }

    if (closingMode === "custom") {
      const keywords = (customClosingKeywords || []).map((k) => k.trim()).filter((k) => k.length > 0);
      if (keywords.length === 0) {
        this.isCloture = false;
        return;
      }
      const keywordsToken = keywords.map((k) => escapeRegExp(k)).join("|");
      this.isCloture = this.message.match(new RegExp(`\\b(?:${keywordsToken})\\b:? *\\b.+\\b`, "gi")) !== null;
      return;
    }

    // Standard GitHub mode
    this.isCloture = this.message.match(/\b((close[sd]?)|(fix(es|ed)?)|(resolve[sd]?))\b:? *\b.+\b/gi) !== null;
  }

  /**
   * Gets the corresponding question from a given list of question thanks to the commit message.
   *
   * A null value is returned if no question has been found
   * @param questions The questions to handle
   * @param closingMode The strategy for question closing commits detection
   * @param customClosingKeywords Custom keywords when closingMode is 'custom'
   */
  updateQuestion(questions: string[], closingMode: QuestionClosingMode = "standard", customClosingKeywords: string[] = []) {
    if (!this.message || !questions || questions.length === 0) {
      this.question = undefined;
      return;
    }

    const sortedQuestions = [...questions].sort((a, b) => b.length - a.length);
    const questionsToken = sortedQuestions.map((q) => escapeRegExp(q)).join("|");

    if (closingMode === "none") {
      const match = this.message.match(new RegExp(`(?:^|\\b|[\\[(#])(${questionsToken})(?:[\\])]|\\b|:|$|\\s)`, "i"));
      this.question = match ? match[1] : undefined;
      return;
    }

    let keywords: string[] = [];
    if (closingMode === "custom") {
      keywords = (customClosingKeywords || []).map((k) => k.trim()).filter((k) => k.length > 0);
    } else {
      keywords = ["Resolve", "Resolves", "Resolved", "Fix", "Fixes", "Fixed", "Close", "Closes", "Closed"];
    }

    if (keywords.length === 0) {
      this.question = undefined;
      return;
    }

    const keywordsToken = keywords.map((k) => escapeRegExp(k)).join("|");
    this.question = this.message.match(new RegExp(`(?:${keywordsToken}) (${questionsToken})(?:\\s|:|$)`, "i"))?.[1];
  }

  /**
   * Updates the commit color
   * @param reviews The reviews to handle
   * @param corrections The corrections to handle
   */
  updateColor(reviews: Milestone[], corrections: Milestone[]) {
    this.color = this.question ? CommitColor.BEFORE : CommitColor.INTERMEDIATE;

    reviews?.forEach((review) => {
      if (review.questions?.includes(this.question)) {
        if (this.commitDate.getTime() > review.date.getTime()) {
          this.color = CommitColor.BETWEEN;
        } else {
          this.color = CommitColor.BEFORE;
        }
      }
    });
    corrections?.forEach((correction) => {
      if (correction.questions?.includes(this.question)) {
        if (this.commitDate.getTime() > correction.date.getTime()) {
          this.color = CommitColor.AFTER;
        } else if (this.color === CommitColor.INTERMEDIATE) {
          this.color = CommitColor.BEFORE;
        }
      }
    });
  }
}
