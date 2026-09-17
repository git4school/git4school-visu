# 0007 - Services de données Git multi-fournisseurs (Pattern Stratégie, Façade & Registre)

## Contexte
Historiquement, la récupération des données de dépôts et de commits dans Git4School était concentrée dans un service monolithique `CommitsService`. Ce dernier combinait plus de 700 lignes de requêtes GraphQL spécifiques à l'API GitHub (`api.github.com`) avec les calculs statistiques et dictionnaires nécessaires aux visualisations D3.js.

L'intégration de GitLab (GitLab Cloud `gitlab.com` et futures instances académiques auto-hébergées) imposait de :
1. Découpler la logique de récupération de données distantes des algorithmes d'analyse et de visualisation.
2. Définir un contrat d'abstraction formel pour les fournisseurs de données Git.
3. Permettre la résolution dynamique de l'hôte distant (*instance host*) afin de supporter nativement les instances GitLab auto-hébergées sans modifier le code applicatif.
4. Conserver une façade unifiée et rétrocompatible pour les composants graphiques existants.

## Options considérées
1. **Ajout de conditions `if (provider === 'gitlab')` au sein de `CommitsService`** :
   - *Rejeté* : Violation flagrante du principe Ouvert/Fermé (OCP) et du principe de responsabilité unique (SRP). Le service aurait accumulé les spécificités de multiples API (GraphQL GitHub vs REST v4 GitLab) au sein du même fichier.
2. **Injection directe des services de données concrets dans chaque composant** :
   - *Rejeté* : Couplage fort des composants d'interface aux détails de chaque forge et duplication de la logique de sélection de stratégie.
3. **Architecture découplée en trois volets : Contrat `GitDataService`, Stratégies concrètes (`GithubDataService`, `GitlabDataService`), Registre polymorphique (`AccountsService`) et Façade (`CommitsService`) (Option retenue)**.

## Décision
1. **Contrat d'abstraction `GitDataService` (`src/app/models/GitDataService.model.ts`)** :
   - Définit le contrat unifié de données Git :
     - `readonly provider: GitProviderType`
     - `getRepositories(repoTab: Repository[], startDate?: string, endDate?: string): Observable<Repository[]>`
     - `getRepositoriesByAuthenticatedUser(cursor?: string, pageLimit?: number): Observable<GitDataSearchResult>`
     - `getRepositoriesBySearch(searchFilter: string, cursor?: string, pageLimit?: number): Observable<GitDataSearchResult>`
     - `verifyUserAccess(repoUrl: string): Observable<any>`
2. **Stratégie GitHub (`GithubDataService`)** :
   - Encapsule les requêtes GraphQL optimisées par lots (*batch queries* de 4 dépôts), la pagination des commits via curseur et la recherche ciblée (dépôt, organisation, recherche globale).
3. **Stratégie GitLab (`GitlabDataService`)** :
   - Implémente l'API REST v4 de GitLab (`/api/v4/projects`).
   - **Support natif des instances auto-hébergées** : Extraction dynamique de l'origine de l'hôte (`new URL(repo.url).origin`) et du chemin de projet encodé (`encodeURIComponent(pathWithNamespace)`).
   - Récupération unifiée des fichiers `IDENTITY.json` et `README.md` via l'API raw files et pagination récursive des commits (`x-next-page`).
4. **Registre centralisé (`AccountsService`)** :
   - Maintient la table de correspondance `dataServices: Map<GitProviderType, GitDataService>`.
   - Expose `getDataService(provider: GitProviderType): GitDataService` et `hasAccount(provider: GitProviderType): boolean`.
5. **Façade unifiée (`CommitsService`)** :
   - Délègue les opérations de chargement et de recherche au `GitDataService` correspondant au type de devoir (`assignment.provider`).
   - Conserve les fonctions de calcul de graphes (dictionnaires de questions, métadonnées, étudiants) en tant que logique métier pure indépendante du fournisseur.
6. **Mise à jour des formulaires et de la modale d'ajout de dépôts** :
   - `ConfigurationComponent`, `EditRepositoriesComponent` et `ModalAddRepositoriesComponent` propagent le type de fournisseur et conditionnent les actions à l'authentification effective sur le fournisseur ciblé (`isConnectedToProvider`).
7. **Rétrocompatibilité et migration Dexie v4** :
   - Migration automatique fixant `provider = "github"` sur tous les devoirs et dépôts préexistants.

## Conséquences
- **Extensibilité** : L'ajout d'une nouvelle forge (ex: forge d'enseignement hébergée, Bitbucket) ne nécessite que la création d'un service implémentant `GitDataService` et son enregistrement dans le registre.
- **Rétrocompatibilité totale** : Les devoirs créés avant la mise à jour continuent de fonctionner à l'identique avec GitHub.
- **Homogénéité mono-fournisseur garantie** : Un devoir est rattaché à une forge unique, évitant les mélanges complexes d'identifiants et de droits d'accès.
- **Expérience utilisateur fluide** : Le bouton de création d'un devoir s'adapte dynamiquement au filtre sélectionné par l'enseignant, tout en offrant 3 déclinaisons d'interaction ergonomiques évaluables via le prototype.
