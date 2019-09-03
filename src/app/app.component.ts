import { Component, OnInit, OnDestroy } from '@angular/core';
import 'rxjs/add/observable/interval';
import { Subscription } from 'rxjs/internal/Subscription';
import { Router } from '@angular/router';
import * as Chart from 'chart.js';
import * as ChartDataLabels from 'chartjs-plugin-datalabels';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '@services/auth.service';
import { DataService } from '@services/data.service';

/**
 * This component is the app component
 */
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  /**
   * This boolean is set to true when authentication is loading
   */
  loading = false;

  /**
   * AppComponent constructor
   * @param authService Authentication service
   * @param dataService Service used to store and get data
   * @param router
   * @param translate Service used to translate the application
   */
  constructor(
    public authService: AuthService,
    public dataService: DataService,
    private router: Router,
    public translate: TranslateService
  ) {
    translate.addLangs(['en', 'fr']);
    translate.setDefaultLang('en');
  }

  /**
   * This method is called once the component is loaded.
   * If the user is not signed in, call the the sign in method.
   */
  ngOnInit(): void {
    Chart.pluginService.unregister(ChartDataLabels);
    if (!this.authService.isSignedIn()) {
      this.loading = true;
      this.authService.callback().then(
        () => {
          this.loading = false;
          this.router.navigate(['overview']);
        },
        () => {
          this.loading = false;
        }
      );
    }
  }

  /**
   * Signs in
   */
  onSignInGithub() {
    this.authService.signIn();
  }

  /**
   * Signs out
   */
  onSignOut() {
    this.authService.signOut();
  }

  /**
   * This method is called when the component is destroyed.
   * Disconnects the user
   */
  ngOnDestroy(): void {
    this.authService.signOut();
  }
}
