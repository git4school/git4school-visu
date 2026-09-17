# 0006 - Authentification multi-forges découplée (Pattern Stratégie & Fournisseurs) et OAuth 2.0 PKCE

## Contexte
Historiquement, Git4School Visu ne prenait en charge que GitHub via un service monolithique `AuthService` s'appuyant directement sur Firebase Authentication (`firebase.auth().signInWithPopup(githubProvider)`).

L'introduction du support de GitLab (dans un premier temps la plateforme SaaS GitLab Cloud `gitlab.com`, puis ultérieurement des instances auto-hébergées GitLab Community) a nécessité la conception d'un mécanisme d'authentification robuste, sécurisé et entièrement exécutable côté client.

L'architecture initiale présentait plusieurs limites structurelles :
1. **Couplage fort au fournisseur GitHub** : `AuthService` était fortement couplé à GitHub et injecté dans plus de quinze composants et services (gardes de routage, barre de navigation, modales, assistants de devoirs).
2. **Absence de contrat d'abstraction** : Aucun contrat formel (interface ou classe abstraite) ne définissait les responsabilités d'un fournisseur d'authentification Git, contraignant les consommateurs à connaître les détails d'implémentation de la forge.
3. **Contraintes de sécurité d'une SPA statique** : Git4School étant une Single Page Application distribuée sans serveur applicatif dédié (hébergée statiquement sur Firebase Hosting), le flux OAuth standard avec secret client (*Authorization Code Grant*) était exclu sous peine de compromettre le secret d'application dans le bundle public. Le standard de l'industrie pour les clients publics sans secret est le protocole **OAuth 2.0 avec PKCE** (*Proof Key for Code Exchange*, RFC 7636).
4. **Duplication d'interface dans la modale d'ajout de compte** : Les panneaux de connexion de la modale (`AddAccountModalComponent`) dupliquaient l'arborescence HTML pour chaque onglet de forge.
5. **Conditions de course et latences d'API à l'authentification** : Les passerelles d'API distribuées (API Gateway de GitLab Cloud) peuvent présenter une brève latence de propagation du jeton nouvellement émis, renvoyant de façon transitoire une erreur 401 Unauthorized lors de l'appel immédiat à `/api/v4/user`. Sans reprise sur erreur et sans affectation atomique de l'état, cela pouvait conduire à des profils orphelins partiels.

## Options considérées
1. **Évolution du service monolithique `AuthService` avec branches conditionnelles** :
   - *Rejeté* : Violait le principe de responsabilité unique (SRP) et le principe Ouvert/Fermé (OCP). Le service aurait combiné Firebase Auth, le protocole PKCE, la gestion multi-tokens et des requêtes HTTP hétérogènes. Tout ajout ultérieur de forge aurait requis la modification du code existant avec risques de régression.
2. **Fournisseurs indépendants injectés individuellement dans les composants** :
   - *Rejeté* : Violait le principe d'inversion des dépendances (DIP). Les composants consommateurs auraient dû injecter concrètement `GithubAuthService`, `GitlabAuthService`, etc., multipliant le couplage et complexifiant la vérification globale de session.
3. **Conservation d'un alias de transition `AuthService` pointant vers `GithubAuthService`** :
   - *Rejeté* : Introduisait une dette technique et une ambiguïté sémantique persistante. Un renommage intégral et sans compromis de toutes les occurrences dans la base de code a été préféré.
4. **Pattern Stratégie / Fournisseur avec contrat unifié `GitAuthProvider` et registre polymorphique `AccountsService` (Option retenue)**.

## Décision
1. **Contrat d'abstraction `GitAuthProvider` (`src/app/models/GitAuthProvider.model.ts`)** :
   - Définition d'une interface formelle définissant le contrat de tout fournisseur d'authentification :
     - Propriétés : `providerType: GitProviderType`.
     - Méthodes du cycle de vie : `signIn(): Promise<void>`, `signOut(): Promise<void>`, `isSignedIn(): boolean`.
     - Accesseurs de données : `getToken(): string | null`, `getUserProfile(): any | null`.
     - Disponibilité fonctionnelle : `isAvailable(): boolean` (permettant la désactivation contextuelle via les feature flags).
2. **Spécialisation de la stratégie GitHub (`GithubAuthService`)** :
   - Renommage exhaustif de `AuthService` en `GithubAuthService` à travers toute l'application (zéro dette technique, zéro shim de compatibilité).
   - Implémentation du contrat `GitAuthProvider` au-dessus de Firebase Auth.
3. **Implémentation de la stratégie GitLab Cloud via OAuth 2.0 PKCE (`GitlabAuthService`)** :
   - Implémentation complète de la RFC 7636 côté client sans dépendance tierce lourde :
     - Génération d'un `code_verifier` aléatoire sécurisé via `window.crypto.getRandomValues`.
     - Dérivation du `code_challenge` par hachage cryptographique `SHA-256` encodé en Base64-URL (`code_challenge_method=S256`).
     - Validation d'état CSRF (`state`) pour prévenir les attaques par falsification de requête inter-sites.
   - Fenêtre popup d'authentification avec composant callback dédié (`GitlabCallbackComponent`, route `/auth/callback`) communiquant le code d'autorisation via `window.postMessage` avec fallback synchronisé sur l'événement `storage` de `localStorage`.
   - **Atomicité de l'état et résilience aux latences de passerelle** :
     - L'affectation de `token` et de `currentUser` est strictement atomique : l'état n'est mis à jour qu'une fois le profil complet validé par l'API.
     - Mécanisme de nouvelle tentative automatique (délai de 500 ms) en cas de code 401 passager lors de la requête `/api/v4/user` afin d'absorber la propagation de réplication du token sur les passerelles d'API GitLab.
4. **Registre polymorphique centralisé (`AccountsService`)** :
   - Enregistrement des stratégies d'authentification dans un registre typé `Map<GitProviderType, GitAuthProvider>`.
   - API de haut niveau pour les composants : `getProvider(type)`, `signIn(type)`, `signOut(type)`, `hasAccount(type)`, `getAccounts()`, `isEmpty()`.
   - Source de vérité unique pour les comptes actifs dans l'application.
5. **Découplage de la garde d'authentification (`AuthGuard`)** :
   - `AuthGuard` ne dépend plus directement de Firebase ni de `GithubAuthService`.
   - La protection des routes s'appuie désormais sur la méthode universelle `!accountsService.isEmpty()`.
6. **Factorisation de l'interface utilisateur (`AddAccountModalComponent`)** :
   - Remplacement de la duplication de code par des blocs réutilisables `ng-template` (`#connectedPanel`, `#disconnectedPanel`) utilisant `ngTemplateOutlet` avec passage de contexte polymorphique.
   - Découplage de la vue vis-à-vis des services concrets (seul `AccountsService` est manipulé).
   - Affichage dynamique du badge de sécurité indiquant le protocole utilisé (`ACCOUNTS.AUTH_TYPE_OAUTH_PKCE`).

## Conséquences
- **Conformité aux principes SOLID** :
  - *SRP* : Chaque fournisseur gère sa propre logique d'authentification et ses protocoles spécifiques.
  - *OCP* : L'ajout de nouveaux fournisseurs (instances GitLab Community auto-hébergées, forge académique, Bitbucket) se fait par simple extension de `GitAuthProvider` et ajout dans le registre de `AccountsService`, sans modifier les composants et gardes existants.
  - *LSP* : Tout consommateur manipulant `GitAuthProvider` peut utiliser indifféremment l'une ou l'autre des implémentations.
  - *DIP* : Les composants de l'application dépendent d'abstractions contractuelles et non d'implémentations concrètes de SDK tiers.
- **Sécurité et conformité client-side** : Intégration conforme aux recommandations de l'IETF pour les clients publics sans exposition de secret d'application.
- **Résilience opérationnelle** : Neutralisation des conditions de course et tolérance aux latences de réplication des tokens OAuth.
- **Base de code assainie** : Élimination définitive des dettes techniques de renommage et factorisation des templates d'interface.
