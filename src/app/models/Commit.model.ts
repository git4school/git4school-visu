import { Milestone } from '@models/Milestone.model';

/**
 * A constant containing the possible types of commits and their corresponding color and label
 */
export const CommitColor = {
  BEFORE: {
    label: 'Before review',
    name: 'green',
    color: 'rgb(53, 198, 146)'
  },
  BETWEEN: {
    label: 'Between review and correction',
    name: 'orange',
    color: 'rgb(255, 127, 74)'
  },
  AFTER: {
    label: 'After correction',
    name: 'red',
    color: 'rgb(203, 91, 68)'
  },
  INTERMEDIATE: {
    label: 'Intermediate commit',
    name: 'black',
    color: 'rgb(77, 77, 77)'
  },
  NOCOMMIT: {
    label: 'Not finished',
    name: 'lightgrey',
    color: 'lightgrey'
  }
};

/**
 * This class modelizes a commit from GitHub, with only useful informations
 */
export class Commit {
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
    public commitDate: Date,
    public url: string,
    public isEnSeance = false,
    public isCloture = false,
    public question?: string,
    public color = CommitColor.INTERMEDIATE
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
    question?: string
  ): Commit {
    return new Commit(
      message,
      author,
      commitDate,
      url,
      isEnSeance,
      isCloture,
      question
    );
  }

  /**
   * Initialize a Commit from the json configuration file
   * @param json The json configuration file
   * @returns A commit
   */
  static withJSON(json): Commit {
    return new Commit(
      json.commit.message,
      json.commit.committer.name,
      json.commit.committer.date,
      json.html_url
    );
  }

  /**
   * Updates the isEnSeance variable
   * @param startDate The date before which commits are not processed
   * @param endDate The date after which commits are not processed
   * @returns A boolean, the isEnSeance value
   */
  updateIsEnSeance(startDate: Date, endDate: Date) {
    if (
      this.commitDate.getTime() >= startDate.getTime() &&
      this.commitDate.getTime() <= endDate.getTime()
    ) {
      this.isEnSeance = true;
      return true;
    }
    return false;
  }

  /**
   * Uopdates the isCloture variable
   * @returns A boolean, the isCloture value
   */
  updateIsCloture() {
    if (
      this.message.match(
        /^\b((close[sd]?)|(fix(es|ed)?)|(resolve[sd]?))\b:? *\b.+\b/gi
      ) !== null
    ) {
      this.isCloture = true;
      return true;
    }
    return false;
  }

  /**
   * Gets the corresponding question from a given list of question thanks to the commit message
   * @param questions The questions to handle
   * @returns A string, corresponding to the question the commit is closing, if found. A null value is returned if no question has been found
   */
  getQuestion(questions: String[]) {
    return !questions
      ? null
      : this.message.split(' ').find(element => {
          return questions.includes(element);
        });
  }

  /**
   * Updates the commits metadata, corresponding to : isCloture, question, color and commitDate
   * @param reviews The reviews to handle
   * @param corrections The corrections to handle
   * @param questions The questions to handle
   */
  updateMetadata(
    reviews: Milestone[],
    corrections: Milestone[],
    questions: string[]
  ) {
    this.updateIsCloture();
    this.question = this.getQuestion(questions);
    this.color = CommitColor.INTERMEDIATE;

    reviews &&
      reviews.forEach(review => {
        if (review.questions && review.questions.includes(this.question)) {
          if (this.commitDate.getTime() > review.date.getTime()) {
            this.color = CommitColor.BETWEEN;
          } else {
            this.color = CommitColor.BEFORE;
          }
        }
      });
    corrections &&
      corrections.forEach(correction => {
        if (
          correction.questions &&
          correction.questions.includes(this.question)
        ) {
          if (this.commitDate.getTime() > correction.date.getTime()) {
            this.color = CommitColor.AFTER;
          } else if (this.color === CommitColor.INTERMEDIATE) {
            this.color = CommitColor.BEFORE;
          }
        }
      });
  }

  /**
   * Updates the commit color
   * @param reviews The reviews to handle
   * @param corrections The corrections to handle
   */
  updateColor(reviews: Milestone[], corrections: Milestone[]) {
    reviews &&
      reviews
        .filter(review => review.date.getTime() < this.commitDate.getTime())
        .forEach(review => {
          if (review.questions) {
            let regex = new RegExp(
              '(' +
                review.questions
                  .map(question => question.replace('.', '\\.'))
                  .join('|') +
                ')\\b'
            );
            if (regex.test(this.message)) {
              this.color = CommitColor.BETWEEN;
            }
          }
        });
    corrections &&
      corrections
        .filter(
          correction => correction.date.getTime() < this.commitDate.getTime()
        )
        .forEach(correction => {
          if (correction.questions) {
            let regex = new RegExp(
              '(' +
                correction.questions
                  .map(question => question.replace('.', '\\.'))
                  .join('|') +
                ')\\b'
            );
            if (regex.test(this.message)) {
              this.color = CommitColor.AFTER;
            }
          }
        });
  }
}
