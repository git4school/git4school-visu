# 0003 - Gestion réactive et découplée des overlays et popovers (Pub/Sub)

## Contexte
Dans la vue d'ensemble (`OverviewComponent`), de multiples éléments d'interface flottants et éphémères cohabitent (infobulles D3, menus contextuels de jalon/séance, suggestions de recherche typeahead, popover d'aide rapide, menu déroulant des groupes de TP, légende interactive).
L'architecture initiale présentait plusieurs fragilités et dettes techniques :
1. **Couplage fort et rôle omniscient du composant parent** : `OverviewComponent` agissait comme un contrôleur impératif manipulant directement ses composants enfants via `@ViewChild` (`closePopovers`, `close`, etc.).
2. **Hacks directs sur le DOM** : Destruction manuelle du DOM via `document.querySelector("ngb-typeahead-window")?.remove()` pour forcer la fermeture du typeahead Bootstrap sans notification Angular.
3. **Couplage du pipeline de données avec l'UI** : Le rechargement des données (`loadGraphDataAndRefresh`, modification des filtres ou de la légende) déclenchait des fermetures intempestives d'overlays et des pertes de focus sur l'input de recherche (`blur`).
4. **Désynchronisation entre D3 et Angular (`NgZone`)** : L'interception d'événements de souris dans D3 (notamment sur `mousedown`) hors de la zone Angular provoquait des glitches visuels lors de la fermeture des dropdowns (suppression immédiate du style CSS `transform` par ng-bootstrap avant le retrait effectif de la classe `.show` par la détection de changement, faisant sauter le menu en haut à gauche sous la barre de navigation pendant l'enfoncement du clic).
5. **Calcul de positionnement dynamique inadapté sur le menu contextuel** : Le menu contextuel utilisait `ngbDropdown` en mode dynamique (Popper.js) sans ancre (`_anchor`), alors qu'il est positionné de manière fixe via les coordonnées de la souris (`position: fixed; [style.left]="left"; [style.top]="top"`).

## Décision
1. **Mise en place d'un service réactif d'orchestration (`OverlayManagerService`)** :
   - Service singleton Angular (`providedIn: 'root'`) implémentant le patron **Publish-Subscribe (Pub/Sub)** via un `Subject<OverlayDismissEvent>`.
   - Typage granulaire des overlays (`OverlayType` : `TOOLTIP`, `CONTEXT_MENU`, `TYPEAHEAD`, `QUICK_HELP`, `DROPDOWN`, `ALL`).
   - Méthodes sémantiques : `dismiss(type, options)`, `dismissAll(options)`, `dismissTransient(options)`.
2. **Synchronisation garantie avec Angular (`NgZone`)** :
   - Encapsulation systématique des émissions d'événements dans `this.ngZone.run(...)` au sein du service pour garantir que tout ordre de fermeture issu de D3 déclenche immédiatement un cycle de détection de changement synchrone sans étape intermédiaire visible.
3. **Autonomie et auto-gestion des composants récepteurs** :
   - `QuestionsChooserComponent`, `OverviewGraphContextualMenuComponent`, `TooltipService` et `OverviewComponent` (pour ses menus locaux de barre d'outils) s'abonnent à `overlayManagerService.dismiss$` et gèrent leur propre fermeture via les API officielles (`dismissPopup()`, `close()`, `hide()`).
   - Désabonnement automatique via l'opérateur RxJS `takeUntil(this.destroy$)` pour prévenir toute fuite mémoire.
4. **Découplage strict entre le rendu D3 et l'état de l'UI** :
   - Le pipeline de chargement des données (`loadGraphData`, `loadGraphDataAndRefresh`) est hermétique et ne déclenche aucune fermeture d'overlay ni de perte de focus.
   - Suppression du listener prématuré `mousedown` sur le conteneur D3 `.chart-container` : la fermeture des overlays s'effectue uniquement lors des gestes physiques de navigation réels (`zoom.on("start")` et `zoom.on("zoom")` avec `event.sourceEvent != null`, `wheel`, `scroll`, glisser-déposer de jalons).
5. **Désactivation du calcul dynamique Popper sur le menu contextuel** :
   - Ajout de l'attribut `display="static"` sur le `<div ngbDropdown>` du menu contextuel pour désactiver le calcul dynamique Popper et laisser le contrôle du positionnement au CSS inline (`position: fixed`).

## Conséquences
- **Élimination complète des hacks DOM** : Plus aucun appel à `querySelector` pour manipuler ou supprimer des éléments de composants tiers.
- **Robustesse et extensibilité** : Tout nouvel overlay ou panneau ajouté dans l'application peut s'abonner à `OverlayManagerService` sans modifier `OverviewComponent`.
- **Fidélité visuelle et fin des sauts d'affichage** : Élimination définitive des scintillements et des sauts de dropdowns sous la barre de navigation.
- **Règle d'architecture formalisée** : Mise à jour de `GEMINI.md` imposant l'usage exclusif de `OverlayManagerService` pour coordonner la fermeture des overlays.
