import { Jalon } from './Jalon.model';

export class Commit {
  constructor(
    public message: string,
    public author: string,
    public commitDate: Date,
    public url: string,
    public isEnSeance = false,
    public isCloture = false,
    public question?: string,
    public color = 'rgb(77, 77, 77)' // black
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
    // TO DO: creer le set de toutes les questions, marquer la dernière question du repo
    return this.message.split(' ').find(element => {
      return questions.includes(element);
    });
  }

  updateMetadata(reviews: Jalon[], corrections: Jalon[]) {
    this.updateIsCloture();
    if (reviews) {
      reviews.forEach(review => {
        const question = this.getQuestion(review.questions);
        if (question) {
          if (this.commitDate.getTime() > review.date.getTime()) {
            this.color = 'rgb(255, 127, 74)'; // orange
          } else {
            this.color = 'rgb(53, 198, 146)'; // green
          }
          this.question = question;
        }
      });
    }
    if (corrections) {
      corrections.forEach(correction => {
        const question = this.getQuestion(correction.questions);
        if (question) {
          if (this.commitDate.getTime() > correction.date.getTime()) {
            this.color = 'rgb(203, 91, 68)'; // red
          } else if (this.color === 'rgb(77, 77, 77)') {
            // if color is black
            this.color = 'rgb(53, 198, 146)'; // green
          }
          this.question = question;
        }
      });
    }
    console.log(
      `{
  ` +
        this.message +
        `
  ` +
        this.question +
        `
}`
    );
  }

  updateColor(reviews: Jalon[], corrections: Jalon[]) {
    // if (!this.isCloture) {
    //   this.color = 'black';
    //   return;
    // }
    if (reviews) {
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
              this.color = 'rgb(255, 127, 74)'; // orange
            }
          }
        });
    }
    if (corrections) {
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
              this.color = 'rgb(203, 91, 68)'; // red
            }
          }
        });
    }
  }
}
