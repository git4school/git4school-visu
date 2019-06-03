import moment from 'moment/src/moment';

export class Seance {
  constructor(
    public startDate: Date,
    public dateFin: Date,
    public groupeTP?: string
  ) {
    this.startDate = moment(startDate, 'DD/MM/YYYY HH:mm').toDate();
    this.dateFin = moment(dateFin, 'DD/MM/YYYY HH:mm').toDate();
  }

  static withJSON(json): Seance {
    return new Seance(json.startDate, json.dateFin, json.groupeTP);
  }

  json() {
    let json = {
      startDate: moment(this.startDate).format('DD/MM/YYYY HH:mm'),
      dateFin: moment(this.dateFin).format('DD/MM/YYYY HH:mm')
    };
    if (this.groupeTP) {
      json['groupeTP'] = this.groupeTP;
    }
    return json;
  }
}
