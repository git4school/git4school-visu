import moment from 'moment/src/moment';

export class Seance {
  constructor(
    public dateDebut: Date,
    public dateFin: Date,
    public label: string,
    public groupeTP?: string
  ) {
    this.dateDebut = moment(dateDebut, 'DD/MM/YYYY HH:mm').toDate();
    this.dateFin = moment(dateFin, 'DD/MM/YYYY HH:mm').toDate();
  }

  static withJSON(json): Seance {
    return new Seance(json.dateDebut, json.dateFin, json.label, json.groupeTP);
  }
}
