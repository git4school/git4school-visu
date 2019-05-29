import moment from 'moment/src/moment';

export class Seance {
  constructor(
    public dateDebut: Date,
    public dateFin: Date,
    public groupeTP?: string
  ) {
    this.dateDebut = moment(dateDebut, 'DD/MM/YYYY HH:mm').toDate();
    this.dateFin = moment(dateFin, 'DD/MM/YYYY HH:mm').toDate();
  }

  static withJSON(json): Seance {
    return new Seance(json.dateDebut, json.dateFin, json.groupeTP);
  }

  json() {
    let json = {
      dateDebut: moment(this.dateDebut).format('DD/MM/YYYY HH:mm'),
      dateFin: moment(this.dateFin).format('DD/MM/YYYY HH:mm')
    };
    if (this.groupeTP) {
      json['groupeTP'] = this.groupeTP;
    }
    return json;
  }
}
