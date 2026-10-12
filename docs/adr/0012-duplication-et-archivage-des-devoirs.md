# 0012 - Duplication et archivage des devoirs depuis la liste d'accueil

## Contexte
Le menu d'actions « liquid » des devoirs exposait déjà trois gouttes — supprimer, dupliquer, archiver — mais seuls `delete` étaient câblés : `duplicate` et `archive` étaient purement décoratifs, sans état ni persistance associés. Le besoin métier est double : repartir rapidement d'un devoir existant pour la période suivante (nouveau titre, mêmes questions/options), et sortir de la liste courante les devoirs des années passées sans les supprimer (leur suppression est irréversible et le rechargement d'un ancien devoir reste légitime).

Deux contraintes structurent la décision : l'année d'un devoir n'est pas dupliquée (elle caractérise la période), et l'archivage doit être un simple rangement, pas une suppression logique avec perte d'accès.

## Décision
1. **Duplication pilotée par un helper pur** : `buildDuplicateTitle` / `buildDuplicateAssignment` (`@services/assignment-duplicate.util`) construisent la copie sans dépendance Angular, donc testables isolément. La copie reprend la forge (`provider`, `instanceHost`, `instanceName`), le titre suffixé, le cours, le programme, les questions, les options de clôture (`closingMode`, `customClosingKeywords`) et la durée de séance par défaut. Elle **ne reprend pas** les dépôts, l'année, les dates, les jalons, les séances ni l'archivage : elle démarre une période propre.
2. **Numérotation des copies** : « TP » → « TP (1) », « TP (1) » → « TP (2) », l'indice étant le premier libre parmi tous les devoirs existants (archivés compris), comparaison insensible à la casse et aux espaces. Le suffixe « (n) » de la source n'est retiré que si le titre appartient déjà à une famille de copies (une base identique ou une copie sœur existe) : un titre isolé comme « TP (2026) » reste sa propre base et sa copie devient « TP (2026) (1) », jamais « TP (2027) ».
3. **Persistance immédiate puis édition** : la copie est écrite en base (`lastModificationDate` via `ClockService`), puis ouverte en édition selon la vue courante (éditeur inline en liste, modale en dossiers), avec le focus placé sur **l'année** — transmis par `ConfigurationService.openConfigurationModal(assignment, { initialFocusField: "year" })` jusqu'à `MetadataComponent` (défaut `"title"`, comportement historique préservé). Le geste « Dupliquer » est un geste « corriger l'année », celle-ci étant le seul champ à renseigner.
4. **Archivage par horodatage** : nouveau champ `archivedAt?: Date` sur `Assignment`, décoré `@Type(() => Date)` (aligné sur `metadata.lastModificationDate`) et **non indexé** — les bases existantes restent compatibles sans migration Dexie. La date n'est posée que par l'action d'archivage (via `ClockService`) et retirée à la restauration ; l'édition de la configuration ne la touche jamais.
5. **Onglet « Archivés »** : cinquième pill de la barre de filtres, toujours visible, en dernière position, avec l'icône boîte du bouton. Le filtre est mutuellement exclusif : tous les autres filtres (dont « Tous ») excluent les devoirs archivés, qui ne sont donc visibles que dans cet onglet. Le tri choisi par l'utilisateur, les filtres avancés et l'export scopé à l'onglet restent inchangés.
6. **Bascule Archiver ↔ Restaurer** : la même goutte morphe (icône boîte → boîte + flèche, tooltip `HOME.RESTORE-ASSIGNMENT`), sans confirmation mais avec toast. Un devoir archivé est visuellement distinct (badge « Archivé », dossier atténué, ligne « Archivé le … » à la place du statut) sans que ses actions changent : le gate de connexion à la forge reste global au menu, comme pour les autres devoirs.
7. **Composant dossiers présentationnel** : `AssignmentFolderViewComponent` relaie deux `@Output` (`duplicate`, `archive`) ; la logique (titre, date d'archivage, toasts, rechargement) reste dans `AssignmentChooserComponent`.

## Conséquences
- Dupliquer un devoir est un geste en deux temps : un clic, puis la saisie de l'année déjà focalisée. La copie existe dès le clic, ce qui est cohérent avec l'autosave de la configuration (un brouillon titré aurait de toute façon été persisté au flush).
- L'archivage est réversible et sans perte : aucune donnée ne bouge, seule la visibilité change. Il bump `lastModificationDate` (c'est une modification du devoir) sans déclencher de rechargement de statistiques.
- Les devoirs archivés restent soumis au gate de connexion : restaurer suppose d'être connecté à la forge du devoir.
- `archivedAt` voyage dans l'export/import JSON (sérialisé en ISO, réhydraté en `Date` par class-transformer) : un import restaure l'état d'archivage.
- La liste « devoirs récents » du panneau de réglages exclut elle aussi les devoirs archivés, par cohérence avec « visible uniquement dans l'onglet Archivés ».

## Alternatives écartées
- **Indice de copie calculé par comptage des copies du devoir source** (plutôt que par recherche du premier indice libre) : produisait des collisions de titres après suppression d'une copie intermédiaire.
- **Dépouillement systématique du suffixe « (n) »** : transformait la copie de « TP (2026) » en « TP (2027) », soit une année au lieu d'un indice de copie.
- **Archivage par drapeau booléen** : ne permet ni de dater ni de trier les devoirs rangés, pour un coût identique à une date.
- **Onglet conditionnel** (affiché seulement s'il existe des archivés) : apparition/disparition déroutante, et décision de rendu dépendante d'un chargement asynchrone.
- **Confirmation modale avant archivage** : action réversible en un clic, une confirmation serait un frein sans bénéfice.
- **Désactivation fine du menu hors connexion** (duplication et archivage locaux) : écartée pour conserver un gate de connexion uniforme sur toutes les actions du devoir.
