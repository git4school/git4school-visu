import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
// import { ConfigurationComponent } from "@components/configuration/configuration.component";
import { FourOhFourComponent } from "@components/four-oh-four/four-oh-four.component";
import { OverviewComponent } from "@components/graphs/overview/overview.component";
import { QuestionsCompletionComponent } from "@components/graphs/questions-completion/questions-completion.component";
import { StudentsCommitsComponent } from "@components/graphs/students-commits/students-commits.component";
import { HomeComponent } from "@components/home/home.component";
import { AuthGuard } from "@guards/auth.guard";
import { DataLoadingGuard } from "@guards/data-loading.guard";
import { DataProvidedGuard } from "@guards/data-provided.guard";

const appRoutes: Routes = [
  { path: "home", component: HomeComponent },
  { path: "", redirectTo: "/home", pathMatch: "full" },
  { path: "not-found", component: FourOhFourComponent },
  {
    path: "overview",
    canActivate: [AuthGuard, DataProvidedGuard],
    canDeactivate: [DataLoadingGuard],
    component: OverviewComponent,
  },
  {
    path: "students-commits",
    canActivate: [AuthGuard, DataProvidedGuard],
    component: StudentsCommitsComponent,
  },
  {
    path: "questions-completion",
    canActivate: [AuthGuard, DataProvidedGuard],
    component: QuestionsCompletionComponent,
  },
  { path: "**", redirectTo: "not-found" },
];

@NgModule({
  imports: [RouterModule.forRoot(appRoutes, { relativeLinkResolution: 'legacy' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
