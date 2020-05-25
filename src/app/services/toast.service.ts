import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

@Injectable({
  providedIn: 'root'
})
export class ToastService {

  constructor(private toastr: ToastrService) { }

  warning(titre, message) {
    this.toastr.warning(message, titre, {
      progressBar: true
    });
  }

  error(titre, message) {
    this.toastr.error(message, titre, {
      progressBar: true,
      enableHtml: true
    });
  }

  success(titre, message) {
    this.toastr.success(message, titre, {
      progressBar: true
    });
  }
}
