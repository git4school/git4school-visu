import moment from 'moment/src/moment';

export class Session {
  constructor(
    public startDate: Date,
    public endDate: Date,
    public tpGroup?: string
  ) {
    this.startDate = moment(startDate, 'DD/MM/YYYY HH:mm').toDate();
    this.endDate = moment(endDate, 'DD/MM/YYYY HH:mm').toDate();
  }

  static withJSON(json): Session {
    return new Session(json.startDate, json.endDate, json.tpGroup);
  }

  json() {
    let json = {
      startDate: moment(this.startDate).format('DD/MM/YYYY HH:mm'),
      endDate: moment(this.endDate).format('DD/MM/YYYY HH:mm')
    };
    if (this.tpGroup) {
      json['tpGroup'] = this.tpGroup;
    }
    return json;
  }
}
