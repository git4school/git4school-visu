export class Commit {
    constructor(
        public message: string,
        public author: string,
        public commitDate: Date,
        public url: string,
        public isEnSeance = false,
        public isCloture = false
    ) {
        this.commitDate = new Date(commitDate);
    }

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

    updateIsEnSeance(dateDebut: Date, dateFin: Date) {
        if (this.commitDate.getTime() >= dateDebut.getTime() && this.commitDate.getTime() <= dateFin.getTime()) {
            console.log('FSSZEZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZz');
            this.isEnSeance = true;
            return true;
        }
        return false;
    }

    updateIsCloture(message: string) {
        if (message.match(/\b((close[sd]?)|(fix(es|ed)?)|(resolve[sd]?))\b/gi) !== null) {
            this.isCloture = true;
            return true;
        }
        return false;
    }
}
