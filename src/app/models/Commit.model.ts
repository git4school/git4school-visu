export class Commit {
    constructor(
        public message: string,
        public author: string,
        public commitDate: Date,
        public url: string
    ) {}

    static withAttributes( message: string,
                           author: string,
                           commitDate: Date,
                           url: string): Commit {
        return new Commit(message, author, commitDate, url);
    }

    static withJSON(json): Commit {
        return new Commit(json.commit.message, json.commit.committer.name, json.commit.committer.date, json.html_url);
    }
}
