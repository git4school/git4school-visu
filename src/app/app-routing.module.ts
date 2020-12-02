import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { ConfigurationComponent } from "@components/configuration/configuration.component";
import { FourOhFourComponent } from "@components/four-oh-four/four-oh-four.component";
import { OverviewComponent } from "@components/graphs/overview/overview.component";
import { QuestionsCompletionComponent } from "@components/graphs/questions-completion/questions-completion.component";
import { StudentsCommitsComponent } from "@components/graphs/students-commits/students-commits.component";
import { HomeComponent } from "@components/home/home.component";
import { AuthGuard } from "@guards/auth.guard";
import { DataLoadingGuard } from "@guards/data-loading.guard";
import { DataSavedGuard } from "@guards/data-saved.guard";

const appRoutes: Routes = [
  { path: "home", component: HomeComponent },
  { path: "", component: HomeComponent },
  { path: "not-found", component: FourOhFourComponent },
  {
    path: "overview",
    canActivate: [AuthGuard],
    canDeactivate: [DataLoadingGuard],
    component: OverviewComponent,
  },
  {
    path: "students-commits",
    canActivate: [AuthGuard],
    component: StudentsCommitsComponent,
  },
  {
    path: "questions-completion",
    canActivate: [AuthGuard],
    component: QuestionsCompletionComponent,
  },
  {
    path: "configuration",
    canActivate: [AuthGuard],
    canDeactivate: [DataSavedGuard],
    component: ConfigurationComponent,
  },
  { path: "**", redirectTo: "not-found" },
];

@NgModule({
  imports: [RouterModule.forRoot(appRoutes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
