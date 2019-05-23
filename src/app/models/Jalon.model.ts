import moment from 'moment/src/moment';

export class Jalon {
  constructor(
    public date: Date,
    public label: string,
    public groupeTP?: number
  ) {
    this.date = moment(date, 'DD/MM/YYYY HH:mm').toDate();
  }

  static withJSON(json): Jalon {
    return new Jalon(json.date, json.label, json.groupeTP);
  }
}
