# 0005 - Neutralisation des conflits souris-clavier dans les suggestions Typeahead (Directive déclarative)

## Contexte
Dans les champs de saisie proposant des suggestions automatiques basées sur `@ng-bootstrap/ng-bootstrap` (`ngbTypeahead`), tels que le choix des questions (`QuestionsChooserComponent`) ou les groupes de TP (`TextInputComponent`), la navigation à l'aide des flèches du clavier (`ArrowDown` / `ArrowUp`) provoquait des sauts visuels brefs et erratiques de la sélection avant de stabiliser l'élément cible.

L'analyse approfondie a mis en évidence trois causes combinées :
1. **Événements `mouseenter` synthétiques du navigateur** : Le template interne de `NgbTypeaheadWindow` écoute `(mouseenter)="markActive(idx)"` sur chaque bouton de suggestion. Lorsqu'un utilisateur navigue au clavier, le pointeur de la souris reste fréquemment immobile au-dessus de la zone d'affichage du dropdown. Chaque appui sur une flèche modifiant le DOM (bascule de la classe `.active`, affichage/masquage du badge de validation), le moteur du navigateur (Chromium / WebKit) réévalue le ciblage sous le pointeur et émet un événement `mouseenter` synthétique, rappelant immédiatement `markActive(idx)` sur l'élément survolé et créant un aller-retour visuel avec la sélection clavier.
2. **Conflit de style `:hover` et `.active`** : La pseudo-classe `:hover` restait active sur l'élément sous le pointeur pendant que `.active` se déplaçait au clavier, allumant deux éléments simultanément avec la couleur de survol.
3. **Latence des transitions CSS** : Les transitions d'arrière-plan (100 à 150 ms) généraient un fondu enchaîné (*cross-fade*) ralentissant la réactivité perçue de la sélection.

## Options considérées
1. **Intégration dans `OverlayManagerService` et `AppComponent`** :
   - *Rejeté* : Violait le principe de responsabilité unique (SRP). `OverlayManagerService` (défini dans l'ADR 0003) est un bus d'événements Pub/Sub dédié à la fermeture ordonnée des overlays (`dismiss$`). Y greffer des écouteurs bas niveau de coordonnées souris et de manipulation du DOM global créait un couplage fort et nécessitait une injection factice dans `AppComponent` pour déclencher les écouteurs par effet de bord de constructeur (*constructor side-effect*).
2. **Gestion locale dans chaque composant (`QuestionsChooserComponent`, `TextInputComponent`)** :
   - *Rejeté* : Violait le principe DRY (*Don't Repeat Yourself*). Dupliquer les écouteurs et l'état de navigation dans chaque composant consommateur de typeahead était redondant et ne protégeait pas les futurs champs de saisie.
3. **Directive déclarative dédiée `TypeaheadKeyboardNavDirective` (Option retenue)**.

## Décision
1. **Création d'une directive déclarative autonome (`TypeaheadKeyboardNavDirective`)** :
   - Déclarée dans `SharedUiModule` avec le sélecteur `input[ngbTypeahead]`.
   - **Principe Ouvert/Fermé (OCP)** : S'applique automatiquement à tous les champs utilisant `ngbTypeahead` dans l'application sans modifier une seule ligne de leur code HTML ou TypeScript.
   - **Cycle de vie strict et écouteurs éphémères** :
     - Écoute `@HostListener("keydown")` sur l'input hôte : dès qu'une touche de navigation (`ArrowDown`, `ArrowUp`, `PageDown`, `PageUp`) est enfoncée alors qu'une fenêtre `ngb-typeahead-window` est ouverte, la directive active la classe `typeahead-keyboard-nav` sur `document.body` via `Renderer2`.
     - Les écouteurs de rétablissement (`mousemove`, `mousedown`, `wheel`) ne sont attachés **que** pendant la phase active de navigation clavier, et sont exécutés hors de la zone Angular (`NgZone.runOutsideAngular`) pour ne déclencher aucun cycle de détection superflu.
     - Un seuil de déplacement physique (`delta > 2px`) filtre les micro-événements synthétiques générés par le navigateur lors des reflows.
     - Dès que la souris bouge réellement, qu'un clic survient, que la touche `Échap`/`Entrée`/`Tab` est pressée, ou lors de la perte de focus (`@HostListener("blur")`), le mode clavier est désactivé et les écouteurs sont **immédiatement détachés** (zéro fuite mémoire, zéro écouteur passif permanent).
2. **Neutralisation CSS via `pointer-events: none` et suppression des transitions** :
   - Sous `body.typeahead-keyboard-nav ngb-typeahead-window` :
     - `pointer-events: none !important` sur tous les enfants pour rendre impossible le déclenchement de `mouseenter` par le navigateur et désactiver la pseudo-classe `:hover`.
     - `transition: none !important` pendant la navigation clavier pour un déplacement instantané (0 ms) de la sélection, net et sans bavure.
   - Dans le CSS standard, dissociation stricte de `&.active` et `&:hover:not(.active)`.
3. **Préservation de la pureté de `OverlayManagerService`** :
   - `OverlayManagerService` conserve son rôle unique de coordinateur de fermeture d'overlays (ADR 0003).

## Conséquences
- **Élimination définitive des sauts et scintillements** : La navigation clavier dans les suggestions est instantanée et fluide, même si le pointeur de la souris repose directement sur la liste.
- **Conformité stricte aux principes SOLID / Clean Code** :
  - *SRP* : Responsabilité unique et isolée dans la directive.
  - *OCP* : Tout futur champ `[ngbTypeahead]` bénéficie du correctif sans modification de code.
  - *Zero idle overhead* : Aucun écouteur global persistant hors interaction clavier active.
- **Expérience utilisateur transparente** : L'interaction à la souris (survol et clic) est réactivée de façon imperceptible dès le moindre mouvement réel de la souris.
