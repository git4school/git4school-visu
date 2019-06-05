import { Jalon } from './Jalon.model';

export class Commit {
  constructor(
    public message: string,
    public author: string,
    public commitDate: Date,
    public url: string,
    public isEnSeance = false,
    public isCloture = false,
    public color = 'green'
  ) {
    this.commitDate = new Date(commitDate);
  }

  static withAttributes(
    message: string,
    author: string,
    commitDate: Date,
    url: string,
    isEnSeance?: boolean,
    isCloture?: boolean
  ): Commit {
    return new Commit(message, author, commitDate, url, isEnSeance, isCloture);
  }

  static withJSON(json): Commit {
    return new Commit(
      json.commit.message,
      json.commit.committer.name,
      json.commit.committer.date,
      json.html_url
    );
  }

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

  updateIsCloture() {
    if (
      this.message.match(
        /\b((close[sd]?)|(fix(es|ed)?)|(resolve[sd]?))\b:? *#[0-9]+/gi
      ) !== null
    ) {
      this.isCloture = true;
      return true;
    }
    return false;
  }

  updateColor(corrections: Jalon[], reviews: Jalon[]) {
    if (reviews) {
      reviews
        .filter(review => review.date.getTime() < this.commitDate.getTime())
        .forEach(review => {
          let regex = new RegExp(
            review.questions
              .map(question => {
                question.replace('.', '\\.');
              })
              .join('|')
          );
          if (regex.test(this.message)) {
            this.color = 'orange';
          }
        });
    }
    if (corrections) {
      corrections
        .filter(
          correction => correction.date.getTime() < this.commitDate.getTime()
        )
        .forEach(correction => {
          let regex = new RegExp(
            correction.questions
              .map(question => {
                question.replace('.', '\\.');
              })
              .join('|')
          );
          if (regex.test(this.message)) {
            this.color = 'rouge';
          }
        });
    }
  }
}
