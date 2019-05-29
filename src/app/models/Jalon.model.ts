import moment from 'moment/src/moment';

export class Jalon {
  constructor(
    public date: Date,
    public label: string,
    public groupeTP?: string
  ) {
    this.date = moment(date, 'DD/MM/YYYY HH:mm').toDate();
  }

  static withJSON(json): Jalon {
    return new Jalon(json.date, json.label, json.groupeTP);
  }

  json() {
    let json = {
      date: moment(this.date).format('DD/MM/YYYY HH:mm'),
      label: this.label
    };
    if (this.groupeTP) {
      json['groupeTP'] = this.groupeTP;
    }
    return json;
  }
}
