import moment from 'moment/src/moment';

export class Jalon {
  constructor(
    public date: Date,
    public label: string,
    public questions?: string[],
    public tpGroup?: string
  ) {
    this.date = moment(date).toDate();
  }

  static withJSON(json): Jalon {
    return new Jalon(json.date, json.label, json.questions, json.tpGroup);
  }

  json() {
    let json = {
      date: moment(this.date).toISOString(),
      label: this.label,
      questions: this.questions
    };
    if (this.tpGroup) {
      json['tpGroup'] = this.tpGroup;
    }
    return json;
  }
}
