import { Commit, CommitColor } from "@models/Commit.model";
import { Milestone } from "@models/Milestone.model";

describe("Commit coloration", () => {
  let commitWIP: Commit;
  let commit1: Commit;
  let commit2: Commit;
  let commit3: Commit;

  beforeEach(() => {
    commitWIP = new Commit(
      "WIP",
      "Author",
      new Date("1/1/2020"),
      "http://github.com/user/repository"
    );
    commit1 = new Commit(
      "Resolve #1:",
      "Author",
      new Date("1/1/2020"),
      "http://github.com/user/repository"
    );
    commit2 = new Commit(
      "Resolve #2:",
      "Author",
      new Date("3/1/2020"),
      "http://github.com/user/repository"
    );
    commit3 = new Commit(
      "Resolve #3:",
      "Author",
      new Date("5/1/2020"),
      "http://github.com/user/repository"
    );
  });

  it("should be black when intermediate", () => {
    commitWIP.updateMetadata([], [], []);

    expect(commitWIP.color).toEqual(CommitColor.INTERMEDIATE);
  });

  it("should be green when closing but no milestone", () => {
    const questions = ["#1"];
    commit1.updateMetadata([], [], questions);

    expect(commit1.color).toEqual(CommitColor.BEFORE);
  });

  it("should be green before a review, orange after", () => {
    const questions = ["#1", "#2"];
    const review = new Milestone(new Date("2/1/2020"), "Review 1", questions);
    commit1.updateMetadata([review], [], questions);
    commit2.updateMetadata([review], [], questions);

    expect(commit1.color).toEqual(CommitColor.BEFORE);
    expect(commit2.color).toEqual(CommitColor.BETWEEN);
  });

  it("should be green before a correction, red after", () => {
    const questions = ["#2", "#3"];
    const correction = new Milestone(
      new Date("4/1/2020"),
      "Correction 1",
      questions
    );
    commit2.updateMetadata([], [correction], questions);
    commit3.updateMetadata([], [correction], questions);

    expect(commit2.color).toEqual(CommitColor.BEFORE);
    expect(commit3.color).toEqual(CommitColor.AFTER);
  });

  it("should be green before a review, orange between, red after a correction", () => {
    const questions = ["#1", "#2", "#3"];
    const review = new Milestone(new Date("2/1/2020"), "Review 1", questions);
    const correction = new Milestone(
      new Date("4/1/2020"),
      "Correction 1",
      questions
    );
    commit1.updateMetadata([review], [correction], questions);
    commit2.updateMetadata([review], [correction], questions);
    commit3.updateMetadata([review], [correction], questions);

    expect(commit1.color).toEqual(CommitColor.BEFORE);
    expect(commit2.color).toEqual(CommitColor.BETWEEN);
    expect(commit3.color).toEqual(CommitColor.AFTER);
  });
});

describe("Question recognition", () => {
  let commit: Commit;
  let questions: string[];

  beforeEach(() => {
    commit = new Commit(
      "",
      "Author",
      new Date("1/1/2020"),
      "http://github.com/user/repository"
    );

    questions = ["#1", "#2", "#3"];
  });

  it("should find with spaces before the message", () => {
    commit.message = "    Resolve #1: WIP";
    commit.updateQuestion(questions);
    expect(commit.question).toEqual("#1");
  });

  it("should find with space between question ID and colon", () => {
    commit.message = "Resolve #1 : WIP";
    commit.updateQuestion(questions);
    expect(commit.question).toEqual("#1");
  });

  it("should find with all the Github closing keywords", () => {
    commit.message = "Resolve #1: WIP";
    commit.updateQuestion(questions);
    expect(commit.question).toEqual("#1");

    commit.message = "Resolves #1: WIP";
    commit.updateQuestion(questions);
    expect(commit.question).toEqual("#1");

    commit.message = "Resolved #1: WIP";
    commit.updateQuestion(questions);
    expect(commit.question).toEqual("#1");

    commit.message = "Fix #1: WIP";
    commit.updateQuestion(questions);
    expect(commit.question).toEqual("#1");

    commit.message = "Fixes #1: WIP";
    commit.updateQuestion(questions);
    expect(commit.question).toEqual("#1");

    commit.message = "Fixed #1: WIP";
    commit.updateQuestion(questions);
    expect(commit.question).toEqual("#1");

    commit.message = "Close #1: WIP";
    commit.updateQuestion(questions);
    expect(commit.question).toEqual("#1");

    commit.message = "Closes #1: WIP";
    commit.updateQuestion(questions);
    expect(commit.question).toEqual("#1");

    commit.message = "Closed #1: WIP";
    commit.updateQuestion(questions);
    expect(commit.question).toEqual("#1");
  });

  it("should be case insensitive", () => {
    commit.message = "rEsoLvE #1: WIP";
    commit.updateQuestion(questions);
    expect(commit.question).toEqual("#1");
  });

  it("shouldn't find question ID without closing keyword", () => {
    commit.message = "WIP #1: finished soon";
    commit.updateQuestion(questions);
    expect(commit.question).toBeUndefined();
  });
});
