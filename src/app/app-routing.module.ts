import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
// import { ConfigurationComponent } from "@components/configuration/configuration.component";
import { FourOhFourComponent } from "@components/four-oh-four/four-oh-four.component";
import { CommitsComponent } from "@components/graphs/commits/commits.component";
import { QuestionsCompletionComponent } from "@components/graphs/questions-completion/questions-completion.component";
import { StudentsComponent } from "@components/graphs/students/students.component";
import { HomeComponent } from "@components/home/home.component";
import { AppNavLayoutComponent } from "@components/nav-layouts/app-nav-layout/app-nav-layout.component";
import { GitlabCallbackComponent } from "@components/auth-callback/gitlab-callback.component";
import { AuthGuard } from "@guards/auth.guard";
import { DataLoadingGuard } from "@guards/data-loading.guard";
import { DataProvidedGuard } from "@guards/data-provided.guard";

const HOME_ROUTES: Routes = [
  { path: "home", component: HomeComponent },
  { path: "not-found", component: FourOhFourComponent },
];

const APP_ROUTES: Routes = [
  {
    path: "commits",
    canActivate: [AuthGuard, DataProvidedGuard],
    canDeactivate: [DataLoadingGuard],
    component: CommitsComponent,
  },
  {
    path: "overview",
    redirectTo: "commits",
    pathMatch: "full",
  },
  {
    path: "students",
    canActivate: [AuthGuard, DataProvidedGuard],
    component: StudentsComponent,
  },
  {
    path: "students-commits",
    redirectTo: "students",
    pathMatch: "full",
  },
  {
    path: "questions-completion",
    canActivate: [AuthGuard, DataProvidedGuard],
    component: QuestionsCompletionComponent,
  },
  { path: "", redirectTo: "/home", pathMatch: "full" },
];

const ROUTES: Routes = [
  { path: "auth/callback", component: GitlabCallbackComponent },
  {
    path: "",
    component: AppNavLayoutComponent,
    children: [...APP_ROUTES, ...HOME_ROUTES],
  },
  { path: "**", redirectTo: "/not-found" },
];

@NgModule({
  imports: [RouterModule.forRoot(ROUTES, { relativeLinkResolution: "legacy" })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
