import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
// import { ConfigurationComponent } from "@components/configuration/configuration.component";
import { FourOhFourComponent } from "@components/four-oh-four/four-oh-four.component";
import { OverviewComponent } from "@components/graphs/overview/overview.component";
import { QuestionsCompletionComponent } from "@components/graphs/questions-completion/questions-completion.component";
import { StudentsCommitsComponent } from "@components/graphs/students-commits/students-commits.component";
import { HomeComponent } from "@components/home/home.component";
import { AppNavLayoutComponent } from "@components/nav-layouts/app-nav-layout/app-nav-layout.component";
import { HomeNavLayoutComponent } from "@components/nav-layouts/home-nav-layout/home-nav-layout.component";
import { AuthGuard } from "@guards/auth.guard";
import { DataLoadingGuard } from "@guards/data-loading.guard";
import { DataProvidedGuard } from "@guards/data-provided.guard";
import { PersonalComponent } from "./components/graphs/personal/personal.component";

const HOME_ROUTES: Routes = [
  { path: "home", component: HomeComponent },
  { path: "not-found", component: FourOhFourComponent },
];

const APP_ROUTES: Routes = [
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
  {
    path: "personal",
    canActivate: [AuthGuard, DataProvidedGuard],
    component: PersonalComponent,
  },
  { path: "", redirectTo: "/home", pathMatch: "full" },
];

const ROUTES: Routes = [
  { path: "", component: AppNavLayoutComponent, children: APP_ROUTES },
  { path: "", component: HomeNavLayoutComponent, children: HOME_ROUTES },
  { path: "**", redirectTo: "/not-found" },
];

@NgModule({
  imports: [RouterModule.forRoot(ROUTES, { relativeLinkResolution: "legacy" })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
