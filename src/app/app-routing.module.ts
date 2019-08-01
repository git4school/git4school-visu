import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CommitsService } from '@services/commits.service';
import { AuthService } from '@services/auth.service';
import { JsonManagerService } from '@services/json-manager.service';
import { DataService } from '@services/data.service';
import { HomeComponent } from '@components/home/home.component';
import { StudentsCommitsComponent } from '@components/graphs/students-commits/students-commits.component';
import { QuestionsCompletionComponent } from '@components/graphs/questions-completion/questions-completion.component';
import { MetadataComponent } from '@components/metadata/metadata.component';
import { OverviewComponent } from '@components/graphs/overview/overview.component';
import { FourOhFourComponent } from '@components/four-oh-four/four-oh-four.component';
import { DataProvidedGuard } from '@guards/data-provided.guard';
import { DataLoadingGuard } from '@guards/data-loading.guard';
import { AuthGuard } from '@guards/auth.guard';

const appRoutes: Routes = [
  { path: 'home', component: HomeComponent },
  { path: '', component: HomeComponent },
  { path: 'not-found', component: FourOhFourComponent },
  {
    path: 'overview',
    canActivate: [AuthGuard],
    canDeactivate: [DataLoadingGuard],
    component: OverviewComponent
  },
  {
    path: 'students-commits',
    canActivate: [AuthGuard, DataProvidedGuard],
    component: StudentsCommitsComponent
  },
  {
    path: 'questions-completion',
    canActivate: [AuthGuard, DataProvidedGuard],
    component: QuestionsCompletionComponent
  },
  {
    path: 'edit-metadata',
    canActivate: [AuthGuard, DataProvidedGuard],
    component: MetadataComponent
  },
  { path: '**', redirectTo: 'not-found' }
];

@NgModule({
  imports: [RouterModule.forRoot(appRoutes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
