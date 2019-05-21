export class Commit {
    constructor(
        public message: string,
        public author: string,
        public commitDate: Date,
        public url: string,
        public isEnSeance = false,
        public isCloture = false
    ) {}

    static withAttributes( message: string,
                           author: string,
                           commitDate: Date,
                           url: string,
                           isEnSeance: boolean,
                           isCloture: boolean): Commit {
        return new Commit(message, author, commitDate, url);
    }

    static withJSON(json): Commit {
        return new Commit(json.commit.message, json.commit.committer.name, json.commit.committer.date, json.html_url);
    }

    updateIsEnSeance(date: Date) {
        this.isEnSeance = (this.commitDate >= date);
    }

    updateIsCloture(message: string) {
        
    }
}
