# 🏛️ Architecture Decision Records (ADR) — Git4School Visu

> Vitrine des choix structurants d'architecture, de conception logicielle, d'ergonomie et de sécurité guidant l'évolution pérenne de **Git4School Visu**.

[![ADRs Documented](https://img.shields.io/badge/ADRs-13%20Documentés-blue.svg?style=flat-square&logo=git)](https://github.com/git4school/git4school-visu/tree/master/docs/adr)
[![Status](https://img.shields.io/badge/Statut-100%25%20Implémenté-success.svg?style=flat-square)](https://github.com/git4school/git4school-visu/tree/master/docs/adr)
[![Architecture](https://img.shields.io/badge/Architecture-Clean%20%2F%20SOLID-orange.svg?style=flat-square)](https://github.com/git4school/git4school-visu)
[![UI Engine](https://img.shields.io/badge/Stack-Angular%2021%20%7C%20Vite%20%7C%20D3.js%20%7C%20Dexie-red.svg?style=flat-square)](https://github.com/git4school/git4school-visu)

---

## 📖 Pourquoi des ADRs dans Git4School Visu ?

Une **ADR (Architectural Decision Record)** est un document court et pragmatique qui capture une décision d'architecture significative, son contexte initial, les options examinées, les justifications techniques et l'ensemble de ses conséquences (positives comme négatives).

Dans un projet open-source et pédagogique comme **Git4School Visu**, les ADRs remplissent quatre rôles fondamentaux :
1. **Mémoire vivante & Rationale** : Comprendre instantanément *pourquoi* un composant ou un service a été conçu ainsi (par ex. pourquoi le protocole PKCE a été retenu pour GitLab ou pourquoi une directive gère le typeahead).
2. **Prévention des régressions d'architecture** : Éviter de réintroduire d'anciennes dettes techniques ou des anti-patterns déjà résolus (ex. hacks directs sur le DOM ou couplages omniscients).
3. **Alignement d'équipe & Intégration fluide** : Accélérer la montée en compétences des nouveaux contributeurs et partenaires académiques.
4. **Gouvernance technique partagée** : Offrir un cadre de conception strict, auditable et pérenne pour guider l'ensemble des développeurs et contributeurs du projet.

---

## 🗺️ Cartographie & Radar Architectural

Le schéma ci-dessous illustre l'imbrication des décisions d'architecture à travers les différentes couches de l'application :

```mermaid
flowchart TB
    subgraph Presentation["🎨 Couche Présentation & UI"]
        ADR0001["<b>ADR-0001</b><br/>Design System Keycap<br/><i>Tokens CSS & Micro-interactions</i>"]
        ADR0005["<b>ADR-0005</b><br/>Directive Typeahead<br/><i>Découplage Souris/Clavier</i>"]
        ADR0009["<b>ADR-0009</b><br/>Détection multilingue<br/><i>Extraction & Morphing Apple</i>"]
        ADR0011["<b>ADR-0011</b><br/>Filtre de groupe de TP<br/><i>Pill de contexte & État réactif</i>"]
    end

    subgraph Reactive["⚡ Couche Orchestration & Événements"]
        ADR0003["<b>ADR-0003</b><br/>OverlayManagerService<br/><i>Patron Pub/Sub & NgZone Sync</i>"]
    end

    subgraph DataDomain["💾 Couche Métier & Persistance"]
        ADR0004["<b>ADR-0004</b><br/>Clôture des Questions<br/><i>Dexie v3 & Modèle Metadata</i>"]
        ADR0010["<b>ADR-0010</b><br/>Sauvegarde automatique<br/><i>Debounce & Flush garanti</i>"]
        ADR0012["<b>ADR-0012</b><br/>Duplication & Archivage<br/><i>Helpers purs & archivedAt</i>"]
    end

    subgraph Integration["🔐 Couche Forges Git & Sécurité"]
        ADR0002["<b>ADR-0002</b><br/>Recherche GraphQL GitHub<br/><i>Découverte Classroom & Orgs</i>"]
        ADR0006["<b>ADR-0006</b><br/>Auth Multi-Forges Découplée<br/><i>Pattern Stratégie & OAuth PKCE</i>"]
        ADR0007["<b>ADR-0007</b><br/>Services de données Git<br/><i>Stratégie, Façade & Registre</i>"]
        ADR0008["<b>ADR-0008</b><br/>Jetons scellés par appareil<br/><i>sessionStorage & Chiffrement XOR</i>"]
    end

    subgraph Tooling["🛠️ Couche Outillage & Build"]
        ADR0013["<b>ADR-0013</b><br/>Angular 21 & Vite<br/><i>esbuild, Node 24 LTS</i>"]
    end

    ADR0005 -.->|S'applique à| ADR0004
    ADR0003 -->|Ordonne la fermeture de| ADR0005
    ADR0003 -->|Gère la fermeture de| ADR0001
    ADR0006 -->|Fournit les accès forges à| ADR0002
    ADR0004 -->|Structure les métadonnées de| ADR0002
    ADR0007 -->|Alimente la façade de données de| ADR0002
    ADR0008 -.->|Scelle les jetons émis par| ADR0006
    ADR0010 -.->|Persiste la configuration issue de| ADR0004
    ADR0012 -.->|Étend le modèle de| ADR0004
    ADR0011 -.->|Filtre les vues orchestrées par| ADR0003

    classDef presentation fill:#e1f5fe,stroke:#0288d1,stroke-width:2px,color:#01579b;
    classDef reactive fill:#fff3e0,stroke:#f57c00,stroke-width:2px,color:#e65100;
    classDef domain fill:#e8f5e9,stroke:#388e3c,stroke-width:2px,color:#1b5e20;
    classDef security fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#4a148c;
    classDef tooling fill:#eceff1,stroke:#546e7a,stroke-width:2px,color:#263238;

    class ADR0001,ADR0005,ADR0009,ADR0011 presentation;
    class ADR0003 reactive;
    class ADR0004,ADR0010,ADR0012 domain;
    class ADR0002,ADR0006,ADR0007,ADR0008 security;
    class ADR0013 tooling;
```

---

## 📊 Tableau de bord des décisions (Index)

| Réf | Décision | Domaine | Patrons & Concepts Clés | Statut | Fichier Source |
| :---: | :--- | :--- | :--- | :---: | :---: |
| **0001** | [Standardisation du composant Keycap](#adr-0001--standardisation-du-composant-keycap-dans-le-design-system) | Design System / A11y | CSS Custom Properties, Balise sémantique `<kbd>`, Dark Mode | `Accepté` | [0001-keycap-design-system.md](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0001-keycap-design-system.md) |
| **0002** | [Découverte des dépôts GitHub GraphQL](#adr-0002--stratégie-de-recherche-et-découverte-des-dépôts-github-graphql) | Intégration API / UX | GraphQL Aliases, GitHub Classroom, Normalisation de motif | `Accepté` | [0002-recherche-et-decouverte-des-depots.md](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0002-recherche-et-decouverte-des-depots.md) |
| **0003** | [Gestion réactive des overlays et popovers](#adr-0003--gestion-réactive-et-découplée-des-overlays-et-popovers-pubsub) | Architecture Réactive | Publish-Subscribe, RxJS `Subject`, Synchronisation `NgZone`, D3.js | `Accepté` | [0003-gestion-reactive-des-overlays-et-popovers.md](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0003-gestion-reactive-des-overlays-et-popovers.md) |
| **0004** | [Clôture des questions et migration Dexie](#adr-0004--stratégie-de-clôture-des-questions-import-en-masse-et-rétrocompatibilité-dexie) | Modèle Métier / Stockage | IndexedDB (Dexie v3), Analyse heuristique Git, Parsing délimité | `Accepté` | [0004-strategie-de-cloture-des-questions-et-retrocompatibilite-dexie.md](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0004-strategie-de-cloture-des-questions-et-retrocompatibilite-dexie.md) |
| **0005** | [Navigation clavier typeahead sans conflit](#adr-0005--neutralisation-des-conflits-souris-clavier-dans-les-suggestions-typeahead-directive-déclarative) | Ergonomie UI / Événements | Directive déclarative Angular, OCP/SRP, `runOutsideAngular`, CSS isolates | `Accepté` | [0005-navigation-clavier-typeahead-directive-decouplee.md](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0005-navigation-clavier-typeahead-directive-decouplee.md) |
| **0006** | [Authentification multi-forges et OAuth 2.0 PKCE](#adr-0006--authentification-multi-forges-découplée-pattern-stratégie--fournisseurs-et-oauth-20-pkce) | Sécurité / Architecture SOLID | Pattern Stratégie, Registre polymorphique, RFC 7636 (PKCE), Web Crypto API | `Accepté` | [0006-authentification-multi-fournisseurs-pattern-strategie.md](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0006-authentification-multi-fournisseurs-pattern-strategie.md) |
| **0007** | [Services de données Git multi-fournisseurs](#adr-0007--services-de-données-git-multi-fournisseurs-stratégie-façade--registre) | Intégration Git / Architecture | Pattern Stratégie, Façade, Registre polymorphique, Migration Dexie v4 | `Accepté` | [0007-services-de-donnees-git-pattern-strategie-et-facade.md](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0007-services-de-donnees-git-pattern-strategie-et-facade.md) |
| **0008** | [Mémorisation sécurisée des jetons (sessionStorage vs localStorage)](#adr-0008--mémorisation-sécurisée-des-jetons-daccès-aux-forges-sessionstorage-vs-localstorage) | Sécurité / Stockage Client | Secure by Default, Chiffrement XOR lié à l'appareil, TTL & purge | `Accepté` | [0008-memorisation-securisee-tokens-forges.md](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0008-memorisation-securisee-tokens-forges.md) |
| **0009** | [Détection multilingue et réaffectation des noms](#adr-0009--détection-multilingue-agnostique-et-réaffectation-des-noms-détudiants) | Métadonnées / UX & Animations | Tokens multilingues, Requête ciblée sans commits, Split Pill & morphing | `Accepté` | [0009-detection-multilingue-et-reaffectation-noms-depots.md](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0009-detection-multilingue-et-reaffectation-noms-depots.md) |
| **0010** | [Sauvegarde automatique de la configuration](#adr-0010--sauvegarde-automatique-de-la-configuration-dun-devoir-debounce--flush) | Persistance / UX | Debounce 600 ms, Flush garanti, Sérialisation des écritures | `Accepté` | [0010-sauvegarde-automatique-de-la-configuration-du-devoir.md](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0010-sauvegarde-automatique-de-la-configuration-du-devoir.md) |
| **0011** | [Placement du filtre de groupe de TP](#adr-0011--placement-du-filtre-de-groupe-de-tp) | Ergonomie UI / Navigation | Pill de contexte segmentée, État réactif `groupFilter$`, OverlayManager | `Accepté` | [0011-placement-du-filtre-de-groupe-de-tp.md](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0011-placement-du-filtre-de-groupe-de-tp.md) |
| **0012** | [Duplication et archivage des devoirs](#adr-0012--duplication-et-archivage-des-devoirs-depuis-la-liste-daccueil) | Modèle Métier / UX | Helpers purs testables, `archivedAt` non indexé, Onglet « Archivés » | `Accepté` | [0012-duplication-et-archivage-des-devoirs.md](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0012-duplication-et-archivage-des-devoirs.md) |
| **0013** | [Migration vers Angular 21 LTS et Vite](#adr-0013--migration-vers-angular-21-lts-et-loutillage-viteesbuild) | Build / Outillage | esbuild & Vite, Montée incrémentale, Node 24 LTS, Interop CommonJS | `Accepté` | [0013-migration-vers-angular-21-et-vite.md](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0013-migration-vers-angular-21-et-vite.md) |

---

## 🌟 Vitrine détaillée des décisions (Showcase)

### ADR-0001 : Standardisation du composant Keycap dans le Design System

> *Harmonisation visuelle, accessibilité sémantique et micro-interactions des touches de raccourcis.*

```
┌────────────────────────────────────────────────────────┐
│  Tags : #DesignSystem #HTML5Sémantique #CSSCustomTokens │
│  Impact : Global UI, ShortcutsModal, Tooltips, Chooser │
└────────────────────────────────────────────────────────┘
```

- **Le Défi** : Les touches de raccourcis clavier et indicateurs d'interaction étaient dispersés dans le code avec des implémentations hétérogènes (balises `<span>` vs `<kbd>`, classes locales `.shortcut-badge`, `.cheat-badge`, `.shortcut-key`, styles d'ombres intérieures vs ombres douces, couleurs hexadécimales en dur).
- **La Décision** :
  1. Centralisation dans `_components.scss` sous les sélecteurs unifiés `kbd, .shortcut-key, .shortcut-badge`.
  2. Standardisation sur la balise sémantique HTML5 native `<kbd class="shortcut-key">`.
  3. Support complet du Dark Mode sans aucune couleur en dur, via les tokens CSS globaux (`--color-bg-body`, `--color-border`, `--color-text-primary`, `--color-primary`).
  4. Création de variantes : taille standard (22px), compacte `.shortcut-key-sm` (18px) pour les zones denses, et conteneur `.shortcut-combo` avec séparateur `.key-sep`.
  5. Micro-interaction d'appui physique (`.shortcut-pressed-anim` avec `scale(0.92)`).
- **Bénéfice majeur** : Un composant d'interface universel, responsive, accessible et parfaitement fondu dans le thème clair comme sombre.
- 📄 Consulter l'ADR complet : [`docs/adr/0001-keycap-design-system.md`](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0001-keycap-design-system.md)

---

### ADR-0002 : Stratégie de recherche et découverte des dépôts GitHub GraphQL

> *Résolution intelligente et arborescente des dépôts étudiants et organisations d'enseignement.*

```
┌──────────────────────────────────────────────────────────────┐
│  Tags : #GraphQL #GitHubClassroom #Algorithme #UXRecherche   │
│  Impact : ModalAddRepositoriesComponent, CommitsService      │
└──────────────────────────────────────────────────────────────┘
```

- **Le Défi** : L'API de recherche globale GitHub n'indexe par défaut que les dépôts publics, rendant les dépôts d'organisations d'enseignement privés (ex: `UE-TOAW`, `CLJ5059A`) introuvables. De plus, la recherche ouverte ramenait des dépôts tiers mondiaux non pertinents, et les dépôts de devoirs créés de manière autonome par GitHub Classroom (sans lien de parenté Git formel `fork`) étaient omis.
- **La Décision** :
  1. **Découverte automatique des organisations** : Récupération des organisations de l'utilisateur avec mise en cache `shareReplay(1)` pour éviter tout appel redondant.
  2. **Multi-requêtes GraphQL parallélisées par alias** : Découpage intelligent selon la saisie (URL directe, préfixe d'organisation, motif `owner/name` ou texte libre).
  3. **Normalisation de motif d'assignation (`extractAssignmentCore`)** : Extraction du cœur sémantique du devoir en éliminant les préfixes d'organisation et suffixes de templates pour identifier à coup sûr tous les dépôts étudiants associés.
  4. **Scission et pliage interactif des résultats** : Séparation claire entre « Correspondances par nom » et « Correspondances dans la description ou le README », avec accordéon interactif.
  5. **Arborescence visuelle des forks** : Dépôts étudiants indentés directement sous le modèle avec guides arborescents `└─`.
- **Bénéfice majeur** : Découverte instantanée et sans friction des promotions entières de TP sans exiger la saisie fastidieuse des dizaines d'URLs étudiantes.
- 📄 Consulter l'ADR complet : [`docs/adr/0002-recherche-et-decouverte-des-depots.md`](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0002-recherche-et-decouverte-des-depots.md)

---

### ADR-0003 : Gestion réactive et découplée des overlays et popovers (Pub/Sub)

> *Éradication des hacks DOM et synchronisation fluide entre D3.js et le cycle de détection Angular.*

```
┌────────────────────────────────────────────────────────────┐
│  Tags : #RxJS #PubSub #NgZone #D3js #ArchitecturePropre    │
│  Impact : OverviewComponent, TooltipService, Typeahead     │
└────────────────────────────────────────────────────────────┘
```

- **Le Défi** : `OverviewComponent` agissait comme un contrôleur omniscient manipulant impérativement ses enfants via de multiples `@ViewChild`. Des hacks destructifs de DOM (`document.querySelector("ngb-typeahead-window")?.remove()`) étaient utilisés pour forcer la fermeture de popups tiers. L'exécution d'événements de souris dans D3 en dehors de la zone Angular générait des sauts graphiques brutaux de dropdowns sous la barre de navigation.
- **La Décision** :
  1. Création de `OverlayManagerService`, un bus d'événements singleton basé sur le patron **Publish-Subscribe** via un `Subject<OverlayDismissEvent>`.
  2. Typage granulaire des overlays (`TOOLTIP`, `CONTEXT_MENU`, `TYPEAHEAD`, `QUICK_HELP`, `DROPDOWN`, `ALL`).
  3. Sécurisation synchrone systématique dans `ngZone.run()` pour forcer un rafraîchissement d'état Angular immédiat sans étape transitoire brisée.
  4. Auto-gestion des composants récepteurs qui s'abonnent et se détruisent proprement via `takeUntil(destroy$)`.
  5. Règle d'architecture formalisée imposant l'usage exclusif de `OverlayManagerService` pour coordonner la fermeture des éléments flottants.
- **Bénéfice majeur** : Plus aucun appel à `querySelector` pour manipuler le DOM de composants tiers, fin définitive des scintillements et stabilité absolue des graphiques D3.
- 📄 Consulter l'ADR complet : [`docs/adr/0003-gestion-reactive-des-overlays-et-popovers.md`](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0003-gestion-reactive-des-overlays-et-popovers.md)

---

### ADR-0004 : Stratégie de clôture des questions, import en masse et rétrocompatibilité Dexie

> *Flexibilité pédagogique sur la détection des commits, assistant ergonomique et migration IndexedDB sans perte.*

```
┌────────────────────────────────────────────────────────────┐
│  Tags : #IndexedDB #Dexie #ModèleMétier #Pédagogie        │
│  Impact : Metadata, CommitModel, QuestionsChooser, Popover │
└────────────────────────────────────────────────────────────┘
```

- **Le Défi** : La détection des questions résolues reposait sur une expression régulière codée en dur ciblant uniquement les verbes GitHub (`fix`, `close`). Les enseignants souhaitant valider les jalons via d'autres mots-clés (`rendu`, `validé`) ou directement par l'identifiant de la question (`[ITER 1]`) étaient bloqués. L'ajout des questions se faisait une à une et risquait de corrompre les devoirs déjà stockés dans IndexedDB.
- **La Décision** :
  1. Enrichissement du modèle `Metadata` avec 3 modes configurables : `standard` (GitHub), `custom` (mots-clés libres de l'enseignant), et `none` (détection directe par nom de question).
  2. Migration de schéma Dexie `version(3)` dans `DatabaseService` garantissant l'initialisation transparente de tous les devoirs existants en base locale sans perte.
  3. Conception du composant `QuestionsAssistantPopoverComponent` intégrant un générateur de séries (`1..N`, `A..Z`), un panneau d'import multi-délimiteurs (`\n`, `,`, `;`, `\t`), et la configuration de la règle de clôture.
  4. Détection intelligente au copier-coller (`paste`) dans le champ des questions avec scission automatique et dédoublonnage.
- **Bénéfice majeur** : Adaptabilité totale à toutes les démarches pédagogiques universitaires et gain de temps massif lors de la configuration des devoirs.
- 📄 Consulter l'ADR complet : [`docs/adr/0004-strategie-de-cloture-des-questions-et-retrocompatibilite-dexie.md`](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0004-strategie-de-cloture-des-questions-et-retrocompatibilite-dexie.md)

---

### ADR-0005 : Neutralisation des conflits souris-clavier dans les suggestions Typeahead (Directive déclarative)

> *Élimination des sauts visuels lors de la navigation fléchée sans toucher au code des composants consommateurs.*

```
┌────────────────────────────────────────────────────────────┐
│  Tags : #DirectiveAngular #SOLID #OCP #PerformanceDOM      │
│  Impact : SharedUiModule, QuestionsChooser, TextInput      │
└────────────────────────────────────────────────────────────┘
```

- **Le Défi** : Lors de la navigation aux flèches dans les suggestions d'autocomplétion (`ngbTypeahead`), le fait de laisser le curseur de la souris immobile sur la liste déclenchait des événements synthétiques `mouseenter` émis par le navigateur lors des reflows DOM. Cela provoquait des allers-retours chaotiques de sélection et un double surbrillance visuelle `:hover` / `.active`.
- **La Décision** :
  1. Conception d'une directive déclarative `TypeaheadKeyboardNavDirective` ciblant `input[ngbTypeahead]`.
  2. Respect strict du principe Ouvert/Fermé (OCP) : s'applique immédiatement à tous les champs présents et futurs sans modifier leur logique métier.
  3. Gestion éphémère des écouteurs d'événements de rétablissement (`mousemove`, `mousedown`, `wheel`) : rattachés uniquement pendant la phase active de navigation clavier, exécutés hors zone Angular (`runOutsideAngular`) avec un seuil de mouvement de sécurité (> 2px) pour filtrer les micro-événements parasites.
  4. Neutralisation CSS instantanée (`pointer-events: none !important` et suppression des transitions pendant la navigation fléchée).
- **Bénéfice majeur** : Navigation clavier d'une netteté parfaite, zéro fuite mémoire, zéro écouteur passif persistant en arrière-plan.
- 📄 Consulter l'ADR complet : [`docs/adr/0005-navigation-clavier-typeahead-directive-decouplee.md`](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0005-navigation-clavier-typeahead-directive-decouplee.md)

---

### ADR-0006 : Authentification multi-forges découplée (Pattern Stratégie & Fournisseurs) et OAuth 2.0 PKCE

> *Ouverture multi-fournisseurs (GitHub + GitLab Cloud), sécurité client-side conforme RFC 7636 et zéro secret applicatif exposé.*

```
┌────────────────────────────────────────────────────────────┐
│  Tags : #OAuth2PKCE #PatternStratégie #RFC7636 #Sécurité   │
│  Impact : AccountsService, GithubAuth, GitlabAuth, Guards  │
└────────────────────────────────────────────────────────────┘
```

- **Le Défi** : L'authentification était historiquement liée de manière monolithique à GitHub via Firebase Auth. L'ouverture à GitLab (plateforme cloud puis instances auto-hébergées) imposait de respecter l'architecture Single Page Application (SPA statique distribuée sur Firebase Hosting) : aucun secret client (*Client Secret*) ne pouvait être inclus dans le code client sans compromettre la sécurité. De plus, les API Gateways de GitLab présentaient parfois de légères latences de propagation du token provoquant des erreurs 401 temporaires.
- **La Décision** :
  1. **Contrat d'interface formel `GitAuthProvider`** : Abstraction normalisée unifiant le cycle de vie (`signIn`, `signOut`, `isSignedIn`, `getToken`, `getUserProfile`, `isAvailable`).
  2. **Pattern Stratégie & Registre centralisé (`AccountsService`)** : Source unique de vérité stockant les fournisseurs dans une table de correspondance typée `Map<GitProviderType, GitAuthProvider>`.
  3. **Implémentation OAuth 2.0 avec PKCE (RFC 7636)** : Flux d'autorisation complet exécuté dans le navigateur sans dépendance externe lourde, utilisant la Web Crypto API (`window.crypto.getRandomValues`, hachage SHA-256 et Base64-URL pour le `code_challenge`, validation du `state` anti-CSRF).
  4. **Résilience et atomicité** : Affectation atomique de la session et mécanisme de nouvelle tentative automatique avec délai d'attente pour absorber les latences de réplication réseau.
  5. **Découplage de `AuthGuard` et polymorphisme d'UI** : `AuthGuard` s'appuie désormais sur `!accountsService.isEmpty()` et la modale d'ajout de compte factorise l'affichage via des templates réutilisables.
- **Bénéfice majeur** : Architecture SOLID hautement extensible permettant d'ajouter facilement toute nouvelle forge (GitLab Community auto-hébergé, Bitbucket, forges universitaires) avec un niveau de sécurité client optimal.
- 📄 Consulter l'ADR complet : [`docs/adr/0006-authentification-multi-fournisseurs-pattern-strategie.md`](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0006-authentification-multi-fournisseurs-pattern-strategie.md)

---

### ADR-0007 : Services de données Git multi-fournisseurs (Stratégie, Façade & Registre)

> *Découpler les forges Git derrière un contrat unique, sans toucher aux composants graphiques.*

```
┌──────────────────────────────────────────────────────────────┐
│  Tags : #PatternStratégie #Façade #OCP #MultiFournisseurs    │
│  Impact : CommitsService, GithubData, GitlabData, Accounts   │
└──────────────────────────────────────────────────────────────┘
```

- **Le Défi** : `CommitsService` concentrait plus de 700 lignes de requêtes GraphQL GitHub mêlées aux calculs statistiques et dictionnaires des visualisations D3. Ouvrir GitLab (Cloud puis instances académiques auto-hébergées) sans empiler des `if (provider === 'gitlab')` imposait de séparer nettement l'accès aux données distantes des algorithmes d'analyse.
- **La Décision** :
  1. **Contrat d'abstraction `GitDataService`** : cycle de vie de données unifié (`provider`, `getRepositories`, `getRepositoriesByAuthenticatedUser`, `getRepositoriesBySearch`, `verifyUserAccess`).
  2. **Stratégies concrètes** : `GithubDataService` (GraphQL optimisé par lots, pagination par curseur) et `GitlabDataService` (REST v4, résolution dynamique de l'hôte auto-hébergé, `IDENTITY.json`/`README.md` en raw).
  3. **Registre polymorphique (`AccountsService`)** : `Map<GitProviderType, GitDataService>` résolue dynamiquement.
  4. **Façade unifiée (`CommitsService`)** : ne conserve que la logique métier pure (dictionnaires de questions, métadonnées, étudiants), indépendante du fournisseur.
  5. **Rétrocompatibilité** : migration **Dexie v4** fixant `provider = "github"` sur les devoirs et dépôts préexistants.
- **Bénéfice majeur** : Ajouter une forge ne nécessite qu'une classe implémentant `GitDataService` et son enregistrement dans le registre.
- 📄 Consulter l'ADR complet : [`docs/adr/0007-services-de-donnees-git-pattern-strategie-et-facade.md`](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0007-services-de-donnees-git-pattern-strategie-et-facade.md)

---

### ADR-0008 : Mémorisation sécurisée des jetons d'accès aux forges (sessionStorage vs localStorage)

> *« Sécurisé par défaut » pour les postes partagés, avec scellement chiffré lié à l'appareil et à l'origine.*

```
┌──────────────────────────────────────────────────────────────┐
│  Tags : #Sécurité #XOR #SecureByDefault #SPAStatique         │
│  Impact : TokenStorageService, AddAccountModal, AuthGuards   │
└──────────────────────────────────────────────────────────────┘
```

- **Le Défi** : En SPA statique sans backend, les cookies `HttpOnly` sont inutilisables pour des API tierces : les jetons vivent nécessairement côté JavaScript. Un `localStorage` inconditionnel exposait les sessions des postes de TP partagés (accès physique) et des failles XSS, tout en rendant les motifs `gho_`/`glpat_` détectables en clair.
- **La Décision** :
  1. **Secure by Default** : case *« Rester connecté »* décochée → `sessionStorage` (détruit à la fermeture de l'onglet) ; cochée → `localStorage` (appareil de confiance).
  2. **`TokenStorageService`** centralisé, multi-forges, API synchrone (pas de race condition à l'instanciation des services/guards).
  3. **Jetons jamais en clair** : IV aléatoire + sel d'appareil (`g4s_device_seed` via `crypto.getRandomValues`), dérivation d'un flux de clé liant origine + sel + IV, masque XOR, signature d'intégrité FNV-1a double passe (rejet + purge immédiate si altération, liaison appareil/origine).
  4. **TTL** : `expiresAt` purgé automatiquement (jetons GitLab PKCE), évitant les appels API en échec silencieux.
  5. **Purge atomique** à la déconnexion (`clearAll`) + fermeture de la session Firebase.
  6. **Sensibilisation UX** : infobulle `[appTooltip]` expliquant le compromis ergonomie / sécurité.
- **Bénéfice majeur** : Aucune session résiduelle sur disque par défaut, contrat de persistance unifié GitHub/GitLab.
- 📄 Consulter l'ADR complet : [`docs/adr/0008-memorisation-securisee-tokens-forges.md`](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0008-memorisation-securisee-tokens-forges.md)

---

### ADR-0009 : Détection multilingue agnostique et réaffectation des noms d'étudiants

> *Extraire le nom d'un étudiant quel que soit le langage de son README, et le corriger en un clic.*

```
┌──────────────────────────────────────────────────────────────┐
│  Tags : #Multilingue #Heuristique #UXApple #PerformanceRéseau│
│  Impact : Utils, GitDataService, EditRepositoriesComponent   │
└──────────────────────────────────────────────────────────────┘
```

- **Le Défi** : L'extraction des noms ne cherchait que les tokens de la langue **actuellement active dans l'interface** : un enseignant en `EN` face à des `README.md` en `FR`/`RU` voyait l'extraction échouer et les dépôts tomber sur leur nom brut. De plus, une fois le devoir persisté, corriger l'algorithme ne rattrapait pas les noms déjà fixés.
- **La Décision** :
  1. **Tokens agnostiques FR/EN/RU** (`LAST_NAME_TOKENS`, `FIRST_NAME_TOKENS`) et variantes Markdown (`**Nom** :`, `*Nom* :`, `# Nom :`) via `Utils.getValueWithTokenFlexible()` et la méthode unifiée `extractRepositoryMetadata()`.
  2. **Contrat `fetchRepositoriesMetadata()`** : GitHub GraphQL ciblé sur `IDENTITY.json`/`README.md` (blobs `HEAD:`), GitLab REST `/repository/files/` — **sans recharger l'historique des commits**.
  3. **Bouton « Apple » à morphing (Split Pill)** : premier clic → état de confirmation (pill scindée), second → appel réseau léger ; icône en rotation pendant le chargement.
  4. **Animation soignée** : *stagger* (`index * 45ms`), flou + glissement (`cubic-bezier(0.23, 1, 0.32, 1)`), toast de rétroaction du nombre de dépôts mis à jour.
- **Bénéfice majeur** : Indépendance linguistique totale et rattrapage en un clic, sans recalculer l'arborescence des commits ni le graphe D3.
- 📄 Consulter l'ADR complet : [`docs/adr/0009-detection-multilingue-et-reaffectation-noms-depots.md`](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0009-detection-multilingue-et-reaffectation-noms-depots.md)

---

### ADR-0010 : Sauvegarde automatique de la configuration d'un devoir (debounce & flush)

> *Plus de bouton « Sauvegarder » : debounce sur les champs libres, persistance immédiate et flush garanti.*

```
┌──────────────────────────────────────────────────────────────┐
│  Tags : #Autosave #Debounce #Flush #Résilience               │
│  Impact : ConfigurationComponent, Metadata, Dexie            │
└──────────────────────────────────────────────────────────────┘
```

- **Le Défi** : La sauvegarde manuelle (pied de page « Annuler / Sauvegarder », bandeau « Modifications non enregistrées », `beforeDismiss`, garde de navigation) perdait toute modification non validée à la fermeture et bloquait l'enregistrement d'un formulaire partiellement invalide.
- **La Décision** :
  1. **Sauvegarde automatique** portée par `ConfigurationComponent` ; suppression du footer, du bandeau, de la confirmation de fermeture et du `DataSavedGuard`.
  2. **Cadence différenciée** : champs libres (titre, cours, programme, année) debouncés 600 ms ; changements discrets (dates, questions, clôture, durée, dépôts) persistés immédiatement.
  3. **Flush garanti** (perte de focus, changement d'onglet, fermeture, `ngOnDestroy`) avec sérialisation et rejeu des écritures concurrentes.
  4. Le titre obligatoire invalide n'est **jamais** persisté ; indicateur discret dans l'en-tête (« Enregistrement… / Enregistré / Titre obligatoire »).
  5. Notifications (`assignmentModified`, `repoToLoad`) déclenchées une seule fois, à la fermeture, pour ne pas recalculer les graphes à chaque frappe.
- **Bénéfice majeur** : Zéro perte de saisie et moins de bruit d'interface (plus de boutons ni de garde).
- 📄 Consulter l'ADR complet : [`docs/adr/0010-sauvegarde-automatique-de-la-configuration-du-devoir.md`](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0010-sauvegarde-automatique-de-la-configuration-du-devoir.md)

---

### ADR-0011 : Placement du filtre de groupe de TP

> *Un contrôle unique et réactif dans la pill de contexte du devoir, à position identique dans toutes les vues.*

```
┌──────────────────────────────────────────────────────────────┐
│  Tags : #UX #ÉtatRéactif #PillSegmentée #OverlayManager      │
│  Impact : AppNavLayout, TpGroupSelector, DataService         │
└──────────────────────────────────────────────────────────────┘
```

- **Le Défi** : Le filtre global (persistant d'un onglet à l'autre) était rendu par un sélecteur **dupliqué** dans chaque toolbar de vue, à des positions divergentes et avec des états visuels légèrement différents : en changeant d'onglet, l'utilisateur pouvait ne plus retrouver le contrôle ni repérer qu'un filtre était actif.
- **La Décision** :
  1. **Sélecteur unique** dans une *pill de contexte du devoir* (navbar) : segment gauche = devoir (configuration, raccourci `C`), segment droit = `TpGroupSelectorComponent` (groupe, chevron, compteurs, raccourci `G`).
  2. **Suppression des quatre dropdowns de toolbar** ; position identique dans toutes les vues.
  3. **État réactif** : `DataService.groupFilter` notifie via `groupFilter$` ; chaque vue s'y abonne (la navbar n'a plus de référence directe sur les vues).
  4. **Détails d'interaction** : capsule bleue encartée quand un groupe est actif, navigation clavier (flèches, Home/End), panneau ajusté au contenu, entrée/sortie en fondu + échelle ancrée au déclencheur.
  5. **Overlays** : fermeture via `OverlayManagerService` (`OverlayType.DROPDOWN`) ; retrait des deux variantes de prototype et de leur harnais après décision.
- **Bénéfice majeur** : Un point d'ancrage unique, l'état actif toujours visible dans la navbar, plus d'incohérence de position.
- 📄 Consulter l'ADR complet : [`docs/adr/0011-placement-du-filtre-de-groupe-de-tp.md`](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0011-placement-du-filtre-de-groupe-de-tp.md)

---

### ADR-0012 : Duplication et archivage des devoirs depuis la liste d'accueil

> *Repartir d'un devoir en deux temps et ranger les années passées sans rien supprimer.*

```
┌──────────────────────────────────────────────────────────────┐
│  Tags : #HelpersPurs #Testabilité #Rétrocompatibilité        │
│  Impact : AssignmentChooser, FolderView, Dexie               │
└──────────────────────────────────────────────────────────────┘
```

- **Le Défi** : Les gouttes « dupliquer » et « archiver » du menu liquide étaient purement décoratives (seul `delete` était câblé). Le besoin : repartir d'un devoir existant (mêmes questions/options, nouvelle année) et sortir de la liste courante les devoirs des années passées **sans suppression irréversible** — l'année n'étant pas dupliquée et l'archivage ne devant pas être une perte d'accès.
- **La Décision** :
  1. **Duplication par helpers purs** `buildDuplicateTitle`/`buildDuplicateAssignment` (`@services/assignment-duplicate.util`), testables sans Angular. La copie reprend forge, titre suffixé, cours, programme, questions, options de clôture et durée de séance — **jamais** les dépôts, l'année, les dates, les jalons, les séances ni l'archivage.
  2. **Numérotation « (n) »** : premier indice libre parmi **tous** les devoirs (archivés compris), comparaison insensible à la casse et aux espaces ; un titre isolé comme « TP (2026) » reste sa propre base.
  3. **Persistance immédiate** (`ClockService`) puis ouverture en édition, focus placé sur **l'année** (`initialFocusField: "year"`).
  4. **Archivage par horodatage** : `archivedAt?: Date` (`@Type(() => Date)`, **non indexé** → aucune migration Dexie), réversible, posé uniquement par l'action d'archivage.
  5. **Onglet « Archivés »** : cinquième pill toujours visible, en dernière position, mutuellement exclusive (exclue partout ailleurs) ; bascule Archiver ↔ Restaurer sur la même goutte, sans confirmation mais avec toast.
  6. **Composant dossiers présentationnel** : `AssignmentFolderViewComponent` relaie deux `@Output` (`duplicate`, `archive`).
- **Bénéfice majeur** : Duplication fiable et sans collision de titres ; archivage réversible, daté, sans perte de données.
- 📄 Consulter l'ADR complet : [`docs/adr/0012-duplication-et-archivage-des-devoirs.md`](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0012-duplication-et-archivage-des-devoirs.md)

---

### ADR-0013 : Migration vers Angular 21 LTS et l'outillage Vite/esbuild

> *Sortir du support webpack déprécié : montée incrémentale vers Angular 21 LTS, build esbuild, serveur de dev Vite et Node 24 LTS.*

```
┌──────────────────────────────────────────────────────────────┐
│  Tags : #Angular21 #Vite #esbuild #Node24 #MontéeIncrémentale│
│  Impact : Build, CI, angular.json, tsconfig, package.json    │
└──────────────────────────────────────────────────────────────┘
```

- **Le Défi** : Le projet tournait sur **Angular 11.0.6** (2020) avec le build **webpack** (`@angular-devkit/build-angular:browser`), Node 16 et TypeScript 4.0. Le support webpack d'Angular est désormais **déprécié** au profit de `@angular/build` (build **esbuild**, serveur de dev **Vite**), mais **aucun support Vite n'existe avant Angular 17** : la montée d'Angular était le prérequis incontournable. S'y ajoutaient des dépendances CommonJS (`moment`, `firebase`) hostiles à l'interopérabilité esbuild.
- **La Décision** :
  1. **Montée incrémentale** `11 → 12 → … → 21 LTS`, une version majeure à la fois, `build` + `tests` verts à chaque saut (un commit par saut).
  2. **Node 16 → 24 LTS** au saut 17 (`.nvmrc`, champ `engines`), Angular 17+ exigé.
  3. **Bascule du builder** vers **`@angular/build:application`** (build esbuild) et **`@angular/build:dev-server`** (Vite) ; port de dev **4200** conservé (redirect URI OAuth).
  4. **Adaptations d'interop esbuild** : `moment` et `firebase` en **import par défaut** (fin des `import * as`), remplacement du `require("../../package.json")` par un import JSON, suppression de l'import Node `assert`, points d'entrée `zone.js` modernisés.
  5. **Outillage lint remis à niveau** (ESLint 8, `typescript-eslint` 8, `@angular-eslint` 21) pour supporter TypeScript 5.9.
- **Bénéfice majeur** : Builds esbuild nettement plus rapides (~12 s), HMR Vite en développement, plus aucune dépendance webpack sur le chemin build/serve.
- **Dette restante assumée** : `firebase` 7 non modulaire (CommonJS), `rxjs` 6 → 7, runner de tests encore Karma (migration Vitest suivie à part).
- 📄 Consulter l'ADR complet : [`docs/adr/0013-migration-vers-angular-21-et-vite.md`](https://github.com/git4school/git4school-visu/blob/master/docs/adr/0013-migration-vers-angular-21-et-vite.md)

---

## 🧭 Principes directeurs de l'architecture Git4School Visu

L'ensemble de ces ADRs applique un socle commun d'exigences et de bonnes pratiques techniques partagées au sein du projet :

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Principes Directeurs Communs                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. SOLID & Clean Code       : Interfaces fortes, découplage, responsabilités│
│                               uniques, zéro code dupliqué.                  │
│ 2. Isolation D3 / Angular   : Respect de NgZone, pas de désynchronisation   │
│                               ni de hacks directs sur le DOM tiers.         │
│ 3. Theming & Tokens CSS     : Compatibilité Dark Mode native sans couleur   │
│                               hexadécimale en dur dans les composants.      │
│ 4. Sécurité Client-Side     : Flux OAuth 2.0 PKCE sans secret client exposé │
│                               dans les bundles frontend.                    │
│ 5. Rétrocompatibilité       : Évolution défensive des schémas IndexedDB     │
│                               avec migration automatisée.                   │
│ 6. Outillage moderne        : Angular 21 LTS, build esbuild & serveur Vite, │
│                               Node 24 LTS, montée incrémentale outillée.    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ✍️ Comment proposer une nouvelle ADR ?

### Cycle de vie d'une décision

```mermaid
stateDiagram-v2
    [*] --> Proposé : Rédaction initiale (PR)
    Proposé --> Accepté : Validation par l'équipe
    Proposé --> Rejeté : Débat & alternatives retenues
    Accepté --> Implémenté : Déploiement dans le code
    Implémenté --> Remplacé : Évolution majeure (Nouvelle ADR)
    Rejeté --> [*]
    Remplacé --> [*]
```

1. **Numérotation séquentielle** : Créer un fichier Markdown dans `docs/adr/` sous la forme `XXXX-titre-court-en-kebab-case.md` (ex: `0007-nouvelle-decision.md`).
2. **Utiliser le template standard** : Renseigner scrupuleusement le contexte, les options étudiées, la décision finale et ses conséquences.
3. **Mettre à jour cette vitrine** : Ajouter la nouvelle entrée dans le tableau de bord et dans la section Showcase.
4. **Mettre à jour la documentation d'architecture** : Référencer la nouvelle règle dans cette vitrine et documenter les impacts techniques.

<details>
<summary><b>📋 Modèle Markdown d'ADR à copier (Template)</b></summary>

```markdown
# XXXX - [Titre de la décision architecturale]

## Contexte
[Décrire la situation initiale, les besoins fonctionnels ou techniques, les limites rencontrées et la dette technique à résoudre.]

## Options considérées
1. **Option A : [Titre]**
   - *Avantages / Inconvénients* : [...]
   - *Verdict* : [Rejeté - Justification]
2. **Option B : [Titre]** (Option retenue)
   - *Avantages / Inconvénients* : [...]

## Décision
1. **[Composant / Service clé]** : [Détail de l'architecture retenue]
2. **[Patron de conception]** : [Explication du découplage et des contrats]
3. **[Règles d'implémentation]** : [Normes de sécurité, d'ergonomie ou de style]

## Conséquences
- **Positives** : [Gains en maintenabilité, performance, extensibilité, sécurité...]
- **Contraintes / Négatives** : [Points d'attention, complexité induite éventuelle...]
- **Mises à jour documentaires** : [Mise à jour de la vitrine d'architecture et des guides associés]
```

</details>

---

*Page maintenue par l'équipe Git4School. Pour toute question ou proposition, ouvrez une issue ou soumettez une Pull Request.*
