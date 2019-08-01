import { Jalon } from '@models/Jalon.model';

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
export class Commit {
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
        /^\b((close[sd]?)|(fix(es|ed)?)|(resolve[sd]?))\b:? *\b.+\b/gi
      ) !== null
    ) {
      this.isCloture = true;
      return true;
    }
    return false;
  }

  getQuestion(questions: String[]) {
    return !questions
      ? null
      : this.message.split(' ').find(element => {
          return questions.includes(element);
        });
  }

  updateMetadata(reviews: Jalon[], corrections: Jalon[], questions: string[]) {
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

  updateColor(reviews: Jalon[], corrections: Jalon[]) {
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
