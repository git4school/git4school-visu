# 0002 - Stratégie de recherche et découverte des dépôts GitHub GraphQL

## Contexte
La modale d'ajout de dépôts (`ModalAddRepositoriesComponent`) permet aux enseignants et étudiants d'importer des dépôts GitHub dans la configuration d'un devoir.
L'utilisation de l'API GraphQL GitHub (`search(query: "...", type: REPOSITORY)`) présentait plusieurs limitations et disparités de comportement :
1. **Dépôts d'organisation privés invisibles** : L'API de recherche globale de GitHub n'indexe par défaut que les dépôts publics. Sans qualifieur explicite `org:<orgName>` ou `user:@me`, les dépôts privés d'organisations d'enseignement (ex: `UE-TOAW`, `CLJ5059A`) étaient introuvables lors d'une recherche par nom ou mot-clé.
2. **Pollution par les dépôts tiers mondiaux** : Une recherche globale ouverte renvoyait des dépôts publics de tiers inconnus sur GitHub (par exemple des modèles de thèses externes lors d'une recherche « manuscrit »).
3. **Disparité entre URL complète et nom court** : L'entrée d'une URL de dépôt se limitait à la résolution directe du dépôt exact et de ses forks formels (`forks`), manquant ainsi les dépôts de devoirs créés de manière autonome au sein d'une organisation par GitHub Classroom.
4. **Déclenchements intempestifs d'événements** : L'écouteur `(keyup)` lançait des requêtes lors de l'appui sur des touches modificatrices (Shift, Cmd, flèches) sans modification textuelle.

## Décision
1. **Découverte automatique des organisations (`getUserOrganizations`)** :
   - Récupération des organisations de l'utilisateur connecté via `viewer { organizations(first: 100) { nodes { login } } }` dans `CommitsService`.
   - Mise en cache avec `shareReplay(1)` pour éviter les appels réseau redondants lors des frappes successives.
2. **Multi-requête GraphQL parallélisée par alias & Extraction du motif d'assignation (`extractAssignmentCore`)** :
   - **URL directe de dépôt ou nom de squelette/template** :
     - Récupération du dépôt exact et de ses forks Git directs (`repository(owner, name) { forks(first: 100) }`).
     - Normalisation via `Utils.extractAssignmentCore(name, owner)` (qui élimine le préfixe d'organisation `ue-toaw-` et les suffixes `_squelette` / `-template` pour isoler `tp-m2sdl-2024-friendsofmine`).
     - Exécution simultanée de `orgSearch: search(query: "<corePattern> org:<owner> fork:true")` pour récupérer l'intégralité des dépôts étudiants générés par GitHub Classroom dans l'organisation.
   - **Recherche par motif `owner/name`** (`UE-TOAW/tp-m2sdl-2024-friendsofmine-` ou `UE-TOAW/ue-toaw-tp_m2sdl_2024_friendsofmine-`) :
     - Résolution du motif d'assignation et recherche circonscrite dans l'organisation avec `corePattern org:<owner> fork:true`.
   - **Texte libre / nom partiel sans préfixe d'organisation** (`tp-m2sdl-2024-friendsofmine-` ou `tp-m2sdl-`) :
     - Résolution automatique du motif via `Utils.extractAssignmentCore`.
     - Recherche simultanée sur le compte utilisateur (`user:@me`), dans **chacune des organisations accessibles de l'utilisateur** (`org:<orgLogin> fork:true`), et en recherche globale GitHub, rendant les dépôts privés d'organisation découvrables même sans spécifier `owner/`.
3. **Différenciation et groupement des correspondances (Nom vs Description / README)** :
   - Lorsque la recherche par texte libre retourne des dépôts dont le nom ne contient pas directement la chaîne recherchée (mais dont la description ou le README correspond), l'interface scinde automatiquement les résultats en deux sections distinctes :
     - *Section 1* : « Correspondances par nom » (`SECTION-NAME-MATCHES`).
     - *Section 2* : « Correspondances dans la description ou le README » (`SECTION-CONTENT-MATCHES`).
   - La description du dépôt est extraite via GraphQL (`description`) et affichée sous le nom du dépôt pour expliciter la pertinence de la correspondance. Les dépôts ne correspondant ni au nom ni au contenu sont strictement éliminés.
4. **Organisation hiérarchique des dépôts étudiants sous le dépôt modèle (`organizeHierarchy`)** :
   - Les dépôts sont rattachés comme forks enfants sous le dépôt source :
     - S'ils possèdent un lien de parenté Git formel (`repo.parentUrl === parent.url`), OU
     - Si un dépôt cible est recherché et que le dépôt étudiant appartient à la même organisation et au même motif d'assignation (`extractAssignmentCore`).
   - Le dépôt modèle est placé en position 0 (racine), immédiatement suivi de l'ensemble de ses forks étudiants indentés avec le guide arborescent `└─` et l'icône de fork.
   - Les cohortes antérieures/ultérieures (ex: 2022 ou 2023 lors d'une recherche sur 2024) sont strictement exclues de l'arborescence.
5. **Optimisations UI et UX** :
   - Suppression du badge redondant `[FORK]` sur les dépôts de premier niveau pour libérer l'espace horizontal et maximiser la lisibilité des intitulés de projets.
   - Structuration stricte du tableau via `<colgroup>` (`52px` checkbox, `48%` nom, `auto` URL) et verrouillage `overflow-x: hidden` pour éliminer tout ascenseur horizontal ou décalage d'en-têtes.
   - Écouteur d'entrée `(input)` avec filtre d'invariance (`cleanValue === this.searchFilter`) pour ignorer les touches modificatrices.
   - Réinitialisation automatique du tri lors de la saisie d'une URL directe pour garantir l'affichage du dépôt cible en position 0.
   - Déduplication stricte par URL (`trackBy: trackByUrl`) pour garantir l'intégrité du rendu Angular.

## Conséquences
- Découverte fluide, exhaustive et sans omission des dépôts d'enseignement privés et publics (GitHub Classroom), qu'ils soient saisis par URL complète, `owner/name`, ou nom partiel sans préfixe.
- Affichage complet et hiérarchisé de tous les dépôts étudiants sous le squelette de devoir correspondant.
- Élimination totale du bruit causé par les promotions passées (ex: 2022/2023 lors d'une recherche 2024).
- Robustesse d'affichage sans débordement ni scroll horizontal, avec troncature fluide des URL longues.
- Conformité stricte avec l'internationalisation (`fr.json`, `en.json`, `ru.json`) et le Design System thémé de l'application.
