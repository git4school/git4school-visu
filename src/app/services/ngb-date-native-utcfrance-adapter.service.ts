import { Injectable } from "@angular/core";
import {
  NgbDateNativeUTCAdapter,
  NgbDateStruct,
} from "@ng-bootstrap/ng-bootstrap";

@Injectable()
export class NgbDateNativeUTCFranceAdapter extends NgbDateNativeUTCAdapter {
  protected _toNativeDate(date: NgbDateStruct): Date {
    const jsDate = new Date(Date.UTC(date.year, date.month - 1, date.day));
    jsDate.setUTCFullYear(date.year);
    jsDate.setUTCHours(jsDate.getUTCHours() - 1);
    return jsDate;
  }
}
