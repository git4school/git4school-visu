# 0009 - Détection multilingue agnostique et réaffectation ciblée des noms d'étudiants

## Contexte
Dans Git4School Visu, lors du chargement initial d'un devoir, l'application analyse les fichiers de métadonnées de chaque dépôt étudiant pour tenter d'extraire le prénom et le nom de l'élève (ou du binôme) :
1. Recherche prioritaire dans `IDENTITY.json`.
2. En cas d'absence, recherche heuristique par motifs textuels (regex) dans `README.md` (clés de type "Nom :", "Prénom :", etc.).
3. À défaut, repli sur le nom brut du dépôt Git.

### Problème identifié
- Jusqu'alors, la recherche de motifs dans `README.md` (`Utils.getValueWithToken`) s'appuyait uniquement sur les traductions de la langue **actuellement active dans l'interface utilisateur** (`ngx-translate`).
- **Cas critique rencontré par les enseignants** : Un enseignant utilisant Git4School avec une interface en anglais (`EN`), mais dont les élèves rendent des devoirs avec des consignes ou des `README.md` en français (`FR`) (ou l'inverse, ou en russe `RU`), voyait l'extraction échouer systématiquement. Les dépôts se voyaient alors attribuer le nom par défaut du dépôt.
- De plus, une fois le devoir créé ou sauvegardé en base locale / Dexie, le simple fait de corriger l'algorithme ne permettait pas de mettre à jour rétroactivement les devoirs déjà existants où le nom brut du dépôt avait déjà été fixé.

---

## Options considérées

1. **Forcer le rechargement complet de tout le devoir (commits + fichiers)** :
   - *Rejeté* : Opération très lourde, consommatrice de quota d'API (GitHub / GitLab) et lente, pouvant effacer d'éventuelles personnalisations non sauvegardées.
2. **Boîte de dialogue modale modale bloquante de confirmation** :
   - *Rejeté* : L'écran de configuration des dépôts est déjà une modale contextuelle (`edit-repositories.component`). Ouvrir une sous-modale ou une alerte native `window.confirm` nuit à l'élégance de l'UX et à l'identité visuelle de l'application.
3. **Détection multilingue agnostique centralisée + Requête API ciblée sans commits + Bouton d'action Apple avec morphing et animation Emil Kowalski (Option retenue)**.

---

## Décision

### 1. Extraction multilingue agnostique dans `Utils`
- Centralisation des tokens pour toutes les langues supportées (FR, EN, RU) :
  - `LAST_NAME_TOKENS` : `nom`, `last name`, `lastname`, `surname`, `фамилия`.
  - `FIRST_NAME_TOKENS` : `prénom`, `prenom`, `first name`, `firstname`, `given name`, `имя`.
- Prise en charge des variations Markdown (`**Nom** :`, `*Nom* :`, `# Nom :`, minuscules/majuscules) via `Utils.getValueWithTokenFlexible()`.
- Méthode unifiée `Utils.extractRepositoryMetadata(identityData, readmeData)` garantissant une détection identique côté GitHub et GitLab, évitant toute duplication de logique.

### 2. Contrat d'API ciblé sans chargement des commits (`RepositoryMetadata`)
- Ajout de `fetchRepositoriesMetadata(repoTab: Repository[]): Observable<RepositoryMetadata[]>` dans le contrat `GitDataService`.
- **GitHub** : Requête GraphQL ciblée interrogeant uniquement les fichiers `IDENTITY.json` et `README.md` (blobs `object(expression: "HEAD:...")`) pour chaque dépôt sans requêter l'historique complet des commits.
- **GitLab** : Requête REST ciblée sur l'API `/repository/files/` pour `IDENTITY.json` et `README.md`.
- Façade unifiée exposée sur `CommitsService`.

### 3. Bouton au design Apple avec confirmation par morphing et pill scindée (Split Pill)
- Bouton placé dans la barre de tri/actions des dépôts :
  - **Premier clic** : Le bouton effectue un morphing vers l'état de confirmation et scinde élégamment l'extrémité droite de la pill (`btn-cancel-refresh-split`) séparée par un fin séparateur vertical.
  - **Couleurs adaptatives par variables CSS** : Bleu Apple doux en thème clair et bleu ardoise sombre (`#1e3a8a` / `#3b82f6`) en thème sombre, évitant les teintes criardes en dark mode.
  - **Deuxième clic (confirmation)** : Déclenche l'appel réseau léger.
  - **Pendant le chargement** : L'icône circulaire tourne (`animation: spin`), le bouton est désactivé.

### 4. Animation fluide inspirée d'Emil Kowalski
- Pour éviter un saut brutal des valeurs dans la liste, un décalage en cascade (*stagger* de `index * 45ms`) est appliqué aux lignes dont le nom a effectivement changé.
- Application d'un micro-flou et glissement (`blur(2px)`, léger `translateY`, courbe `cubic-bezier(0.23, 1, 0.32, 1)`).
- Mise à jour du `FormGroup` et synchronisation persistante via le service d'assignation.
- Toast de rétroaction clair via `ToastService` indiquant le nombre exact de dépôts mis à jour.

---

## Conséquences

### Positives
- **Indépendance linguistique totale** : Un enseignant peut travailler avec l'interface dans n'importe quelle langue sans compromettre la détection des noms d'étudiants.
- **Rattrapage immédiat** : Les devoirs déjà existants ou nouvellement importés peuvent être ré-analysés en 1 clic sans recharger tout le devoir.
- **Sobriété réseau** : Les métadonnées sont chargées sans recalculer l'arborescence des commits ni le graphe D3.
- **Expérience utilisateur Apple** : Aucune modale intrusive, transition fluide et animation soignée.

### Neutres
- Si un étudiant a écrit son nom sous un format non standard non présent dans les tokens, le nom ne sera pas extrait et restera modifiable manuellement dans le formulaire d'édition.
