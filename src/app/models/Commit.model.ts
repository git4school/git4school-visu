export class Commit {
    constructor(
        public message: string,
        public author: string,
        public commitDate: Date
    ) {}

    static withAttributes( message: string,
                           author: string,
                           commitDate: Date): Commit {
        return new Commit(message, author, commitDate);
    }

    static withJSON(json): Commit {
        return new Commit(json.commit.message, json.commit.author.name, json.commit.author.date);
    }
}
