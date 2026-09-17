# 0008 - Mémorisation sécurisée des jetons d'accès aux forges (sessionStorage vs localStorage) et sensibilisation aux risques XSS

## Contexte
Avec l'introduction de l'authentification multi-forges (GitHub OAuth et GitLab OAuth 2.0 PKCE, voir [ADR 0006](./0006-authentification-multi-fournisseurs-pattern-strategie.md)), les utilisateurs devaient jusqu'ici se ré-authentifier à chaque fermeture ou réouverture de page (dans le cas de GitLab dont l'état n'était pas persisté), ou dépendaient d'une persistance locale inconditionnelle (Firebase Auth pour GitHub).

Plusieurs contraintes majeures caractérisent l'architecture de Git4School Visu :
1. **Application cliente statique sans serveur applicatif (Serverless SPA)** :
   Git4School est hébergée sous forme d'actifs statiques (HTML/JS/CSS). Les requêtes vers les API des forges (GitHub REST/GraphQL, GitLab REST v4) sont émises directement par le navigateur de l'utilisateur avec un en-tête `Authorization: Bearer ...` ou `token ...`.
2. **Impossibilité d'utiliser des cookies `HttpOnly` pour les API tierces directes** :
   Les cookies `HttpOnly` protégés contre les scripts ne peuvent être définis que par le domaine émetteur de l'API ou via un proxy backend inverse dédié. En l'absence de backend intermédiaire, les jetons d'accès doivent nécessairement être manipulés par le code JavaScript côté client.
3. **Risques inhérents au stockage persistant (`localStorage`)** :
   - **Accès physique ou machine partagée** : Dans les salles de travaux pratiques ou sur un ordinateur public/partagé, un jeton laissé en `localStorage` survit à la fermeture du navigateur. Tout utilisateur ultérieur sur la même session machine accède directement aux dépôts Git de l'enseignant ou de l'étudiant.
   - **Vulnérabilité aux attaques XSS (Cross-Site Scripting)** : Tout script injecté ou extension de navigateur malveillante accédant au contexte de la page peut lire l'intégralité du `localStorage`.
   - **Scanners d'extensions et fuite accidentelle** : Les jetons bruts stockés en clair avec des motifs reconnaissables (`gho_`, `glpat-`) peuvent être détectés par des outils tiers ou inclus involontairement dans des rapports d'erreurs.

L'objectif est d'offrir le choix explicite à l'utilisateur de mémoriser sa session sur son appareil personnel de confiance, tout en garantissant un niveau de sécurité optimal adapté à l'architecture sans backend et en l'alertant en toute transparence sur les risques associés.

---

## Options considérées

1. **Persistance inconditionnelle en `localStorage` pour tous les utilisateurs** :
   - *Rejeté* : Dangereux en environnement éducatif (salles de TP, ordinateurs en libre accès). Risque critique d'usurpation d'identité et d'accès non autorisé aux dépôts des utilisateurs précédents.
2. **Stockage en mémoire vive uniquement (aucun stockage navigateur)** :
   - *Rejeté* : Expérience utilisateur dégradée. Tout rafraîchissement de page (`F5`) ou navigation inter-onglets déconnecte instantanément l'utilisateur et interrompt les flux de travail en cours.
3. **Ségrégation conditionnelle `sessionStorage` (par défaut) vs `localStorage` (choix explicite) avec scellement chiffré/obfusqué et purge garantie (Option retenue)**.

---

## Décision

1. **Principe du "Sécurisé par défaut" (Secure by Default)** :
   - Lors de la connexion à une forge (GitHub ou GitLab), la case *"Rester connecté sur cet appareil"* est **décochée par défaut**.
   - **Case décochée** : Les jetons d'accès et profils sont stockés dans `sessionStorage`. Dès la fermeture de l'onglet ou du navigateur, le stockage est instantanément détruit par le navigateur, sans laisser de trace sur le disque.
   - **Case cochée** : Les données sont enregistrées dans `localStorage` afin de persister d'une session à l'autre sur l'appareil de confiance.

2. **Service centralisé `TokenStorageService` (`src/app/services/token-storage.service.ts`)** :
   - Encapsule l'ensemble des opérations de stockage des identifiants et données de profil pour toutes les forges (`github`, `gitlab`).
   - Fournit une API synchrone garantissant la disponibilité immédiate du token lors de l'instanciation des services et gardes Angular, sans race conditions.

3. **Algorithme de scellement lié à l'appareil et à l'origine avec contrôle d'intégrité** :
   - Les jetons ne sont jamais stockés en clair dans le stockage du navigateur.
   - À l'écriture, une enveloppe structurée est créée :
     - Génération d'un vecteur d'initialisation aléatoire (`iv`).
     - Génération et conservation d'un sel cryptographique unique par installation/appareil (`g4s_device_seed`) tiré via `crypto.getRandomValues`, évitant tout secret statique en dur dans le bundle JS.
     - Dérivation d'un flux de clé pseudo-aléatoire (LCG) combinant l'origine (`window.location.origin`), le sel d'appareil et l'IV.
     - Chiffrement par masque XOR du JSON sérialisé (`token`, `provider`, `createdAt`, `expiresAt`).
     - Calcul d'une signature d'intégrité (hachage FNV-1a à double passe) sur l'ensemble `(origine + sel appareil + IV + clair + exp)`.
   - À la lecture :
     - Vérification de la signature d'intégrité : toute modification externe ou altération de données entraîne le rejet immédiat du jeton et la purge de l'entrée.
     - Liaison appareil & origine : un jeton exporté ou injecté sur une autre machine ou une autre origine ne peut être déchiffré.
     - Détection des scans de regex : aucun motif de token (`gho_`, `glpat-`) n'apparaît en clair dans les clés ou valeurs de stockage.

4. **Gestion de l'expiration et éviction automatique (TTL)** :
   - Les jetons GitLab OAuth PKCE sont accompagnés d'une durée de validité (`expires_in`, typiquement 7200 secondes).
   - L'enveloppe enregistre `expiresAt`. Si `Date.now() > expiresAt` lors de la lecture, le jeton est immédiatement purgé et l'utilisateur est considéré comme déconnecté, évitant des échecs d'appels API silencieux en boucle.

5. **Purge atomique à la déconnexion (`signOut`)** :
   - Lors de la déconnexion, `tokenStorageService.clearAll(provider)` purge simultanément les données dans `sessionStorage` et `localStorage`.
   - La session Firebase Auth est également fermée.

6. **Sensibilisation et avertissement contextuel (Infobulle UX)** :
   - Dans `AddAccountModalComponent`, un indicateur d'information avec infobulle interactive (`[appTooltip]`) prévient l'utilisateur :
     > *"Le jeton sera stocké dans le localStorage de votre navigateur. Pratique pour éviter de vous reconnecter, mais sensible aux failles XSS et à l'accès physique à l'appareil. À n'activer que sur un ordinateur personnel de confiance."*

---

## Conséquences

- **Sécurité renforcée en milieu universitaire/scolaire** :
  Par défaut, aucun jeton ne persiste sur le disque local. Les étudiants et enseignants utilisant des postes partagés ne risquent pas d'abandonner leur session active après fermeture du navigateur.
- **Transparence totale pour l'utilisateur** :
  L'utilisateur est conscient du compromis ergonomie / sécurité (commodité de ne pas retaper ses accès vs exposition en cas de faille XSS ou de machine partagée).
- **Uniformité multi-forges** :
  GitHub et GitLab partagent désormais le même contrat et le même cycle de vie de persistance sécurisée via `TokenStorageService`.
- **Nettoyage de la dette technique** :
  L'ancien mécanisme de token de développement (`dev_github_token`) et la ré-authentification automatique Firebase par popup (`reauthenticate()`) sont définitivement supprimés au profit de la mémorisation sécurisée explicite *"Rester connecté"* et de la restauration synchrone de session.
