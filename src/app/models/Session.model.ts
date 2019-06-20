import moment from 'moment/src/moment';

export class Session {
  constructor(
    public startDate: Date,
    public endDate: Date,
    public tpGroup?: string
  ) {
    this.startDate = moment(startDate).toDate();
    this.endDate = moment(endDate).toDate();
  }

  static withJSON(json): Session {
    return new Session(json.startDate, json.endDate, json.tpGroup);
  }

  json() {
    let json = {
      startDate: moment(this.startDate).toISOString(),
      endDate: moment(this.endDate).toISOString()
    };
    if (this.tpGroup) {
      json['tpGroup'] = this.tpGroup;
    }
    return json;
  }
}
