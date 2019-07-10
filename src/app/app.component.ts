import { Component, OnInit, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/interval';
import { Subscription } from 'rxjs/internal/Subscription';
import { AuthService } from './services/auth.service';
import { DataService } from './services/data.service';
import { Router } from '@angular/router';
import * as Chart from 'chart.js';
import * as ChartDataLabels from 'chartjs-plugin-datalabels';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  secondes: number;
  counterSubscription: Subscription;
  loading = false;

  constructor(
    public authService: AuthService,
    public dataService: DataService,
    private router: Router
  ) {}

  ngOnInit(): void {
    Chart.pluginService.unregister(ChartDataLabels);
    if (!this.authService.isSignedIn('ngOnInit')) {
      this.loading = true;
      this.authService.callback().then(
        () => {
          this.loading = false;
          this.router.navigate(['graph']);
        },
        () => {
          this.loading = false;
        }
      );
    }
  }

  onSignIn() {
    this.authService.signIn().then(() => {});
  }

  onSignInGithub() {
    this.authService.signIn();
  }

  onSignOut() {
    this.authService.signOut();
  }

  ngOnDestroy(): void {
    this.counterSubscription.unsubscribe();
    this.authService.signOut();
  }
}
