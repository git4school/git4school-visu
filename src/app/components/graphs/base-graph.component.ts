import { Component, ElementRef, OnDestroy, OnInit } from "@angular/core";
import { Milestone } from "@models/Milestone.model";
import { Repository } from "@models/Repository.model";
import { AnonymizationService } from "@services/anonymization.service";
import { AssignmentsService } from "@services/assignments.service";
import { DataService } from "@services/data.service";
import { LoaderService } from "@services/loader.service";
import { TranslateService } from "@ngx-translate/core";
import { Subject, Subscription } from "rxjs";
import { skip, takeUntil } from "rxjs/operators";

/** Ce dont une vue graphe a besoin pour démarrer (ses propres méthodes de rendu). */
export interface GraphViewBootstrap {
  /** Recharge les données et redessine. */
  refresh: () => void;
  /** Redessine avec les données courantes (appelé au redimensionnement). */
  draw: () => void;
  /** Y a-t-il des données à dessiner ? */
  hasData: () => boolean;
  /** Conteneur observé pour redessiner au redimensionnement. */
  observe: () => ElementRef | HTMLElement | null;
  /** Prépare la vue (curseur de dates, métadonnées) quand il n'y a pas de dépôt à charger. */
  seed?: () => void;
}

/**
 * Base commune des vues graphes : abonnements partagés (devoir modifié, filtre de groupe,
 * changement de langue, mode anonymat), amorçage des données et observation de la taille.
 *
 * Les quatre vues avaient recopié ce bloc ; les abonnements langue/anonymat n'étaient d'ailleurs
 * jamais désabonnés. Ils le sont maintenant, en un seul endroit.
 */
@Component({
  template: "",
  standalone: false,
})
export abstract class BaseGraphComponent implements OnInit, OnDestroy {
  public loading = false;

  protected assignmentsModified$?: Subscription;
  protected groupFilterSub?: Subscription;
  private readonly viewDestroy$ = new Subject<void>();
  private resizeObserver: any = null;

  constructor(
    protected loaderService: LoaderService,
    protected assignmentsService: AssignmentsService,
    protected dataService: DataService,
    protected translateService: TranslateService,
    protected anonymizationService: AnonymizationService,
  ) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.viewDestroy$.next();
    this.viewDestroy$.complete();
    if (this.groupFilterSub) {
      this.groupFilterSub.unsubscribe();
    }
    if (this.assignmentsModified$) {
      this.assignmentsModified$.unsubscribe();
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  /**
   * Démarre la vue : abonnements communs, données (dépôt à charger ou amorçage local), puis
   * observation de la taille du conteneur pour redessiner.
   */
  protected startGraphView(bootstrap: GraphViewBootstrap): void {
    this.assignmentsModified$ = this.subscribeAssignmentModified();
    /* Le filtre de groupe est global (navbar) : rafraîchir la vue à chaque changement. */
    this.groupFilterSub = this.dataService.groupFilter$.pipe(takeUntil(this.viewDestroy$)).subscribe(() => bootstrap.refresh());
    this.translateService.onLangChange.pipe(takeUntil(this.viewDestroy$)).subscribe(() => bootstrap.refresh());
    this.anonymizationService.isAnonymous$.pipe(skip(1), takeUntil(this.viewDestroy$)).subscribe(() => bootstrap.refresh());

    if (this.dataService.repoToLoad) {
      this.loadGraph(this.dataService.startDate, this.dataService.endDate);
    } else if (bootstrap.seed) {
      this.loading = true;
      bootstrap.seed();
      this.loading = false;
    } else {
      bootstrap.refresh();
    }

    const target = bootstrap.observe();
    const element: HTMLElement | null = target instanceof ElementRef ? target.nativeElement : (target as HTMLElement | null);
    if (element) {
      this.resizeObserver = new (window as any).ResizeObserver(() => {
        if (bootstrap.hasData()) {
          bootstrap.draw();
        }
      });
      this.resizeObserver.observe(element);
    }
  }

  subscribeAssignmentModified(): Subscription {
    return this.assignmentsService.assignmentModified.pipe(takeUntil(this.viewDestroy$)).subscribe(() => {
      this.loadGraph(this.dataService.startDate, this.dataService.endDate);
    });
  }

  unsubscribeAssignmentModified(assignmentsModified$: Subscription) {
    if (assignmentsModified$) {
      assignmentsModified$.unsubscribe();
    }
  }

  abstract loadGraph(startDate?: string, endDate?: string);

  loadGraphMetadata(repositories: Repository[], reviews: Milestone[], corrections: Milestone[], questions, conserveZoom: boolean = false) {
    this.loaderService.loadCommitsMetadata(repositories, reviews, corrections, questions);
    this.loadGraphDataAndRefresh(conserveZoom);
  }

  abstract loadGraphDataAndRefresh(conserveZoom?: boolean);
}
