export class Metadata {
  /**
   * The document title
   */
  title: string;

  /**
   * A date before which commits are not retrieved from Github
   */
  startDate: string;

  /**
   * A date after which commits are not retrieved from Github
   */
  endDate: string;

  /**
   * The course associated with the configuration file
   */
  course: string;

  /**
   * The program associated with the configuration file
   */
  program: string;

  /**
   * The year associated with the configuration file
   */
  year: string;

  /**
   * The questions that will be handled by the application
   */
  questions: string[];

  /**
   * The date the assignment was last modified
   */
  lastModificationDate: Date;

  constructor() {
    this.questions = [];
  }
}
