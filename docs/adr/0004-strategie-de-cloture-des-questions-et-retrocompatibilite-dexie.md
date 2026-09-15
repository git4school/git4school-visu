# 0004 - Stratégie de clôture des questions, import en masse et rétrocompatibilité Dexie

## Contexte
Dans Git4School, la détection des jalons pédagogiques (questions) résolus par les étudiants reposait jusqu'alors sur une expression régulière codée en dur dans `Commit.model.ts`, ciblant exclusivement les verbes de clôture par défaut de GitHub (`fix`, `fixes`, `resolve`, `close`, etc.).
Cette approche présentait plusieurs limites :
1. **Absence de flexibilité pédagogique** : Certains enseignants n'utilisent pas de mots-clés d'action dans les consignes données aux étudiants, mais demandent d'indiquer directement le nom de la question (ex: `[ITER 1]`, `Q1: ...`), ou utilisent des verbes spécifiques dans leur établissement (ex: `rendu`, `validé`, `fini`).
2. **Saisie laborieuse des questions** : L'ajout de questions dans le devoir s'effectuait obligatoirement une à une au clavier sans possibilité de copier-coller une liste ou de générer des séries (`ITER 1..N`, `A..Z`).
3. **Péril de rétrocompatibilité des données persistées** : La base locale IndexedDB (via Dexie) contient déjà les devoirs des utilisateurs sans ces nouveaux paramètres de clôture. Toute évolution du modèle `Metadata` doit garantir la continuité sans perte de données.

## Décision
1. **Enrichissement du modèle `Metadata` avec rétrocompatibilité Dexie** :
   - Ajout des propriétés `closingMode: "standard" | "custom" | "none"` (valeur par défaut : `"standard"`) et `customClosingKeywords: string[]` (valeur par défaut : `[]`).
   - Migration de base de données Dexie `version(3)` dans `DatabaseService` garantissant l'initialisation de ces champs pour tous les devoirs existants en base.
   - Getters de repli défensifs dans la classe `Metadata` pour garantir que toute désérialisation brute (ex: imports JSON tiers) retombe sur le standard GitHub si les propriétés sont manquantes.
2. **Moteur d'analyse Git configurable (`Commit.model.ts`)** :
   - Support des trois modes :
     - `standard` : détection par les verbes GitHub usuels (`Resolve`, `Fix`, `Close`).
     - `custom` : détection par la liste de mots-clés personnalisés spécifiés par l'enseignant.
     - `none` : détection par mot entier de l'identifiant de la question sans exiger de verbe d'action, marquant immédiatement le commit comme clôture (`isCloture = true`).
   - Transmission des options de clôture depuis `Metadata` à travers `LoaderService` vers `Commit.updateMetadata()`.
3. **Assistant de questions sous forme de Popover contextuel (`QuestionsAssistantPopoverComponent`)** :
   - Positionné en bouton préfixe adjacent à gauche du champ des questions (`questions-chooser`).
   - Indicateur visuel discret (*accent dot*) si un mode non-standard est actif.
   - Intégration de 3 onglets compacts :
     - `🪄 Séquence` : Générateur dynamique (préfixe libre, intervalle 1..N ou A..N, padding zéro, aperçu temps réel).
     - `📋 Liste` : Zone d'importation multiligne avec détection automatique multi-délimiteurs (`\n`, `,`, `;`, `\t`).
     - `⚙️ Clôture` : Configuration de la règle de reconnaissance des commits.
   - Intégration réactive à `OverlayManagerService` pour une fermeture harmonieuse lors des clics extérieurs ou changements de contexte.
4. **Détection automatique au collage direct dans `questions-chooser`** :
   - Lors d'un événement `paste` dans le champ d'ajout de questions, si des séparateurs évidents (`\n`, `,`, `;`, `\t`) sont présents, scission automatique en questions distinctes avec dédoublonnage transparent.

## Conséquences
- **Rétrocompatibilité totale** : Les devoirs historiques continuent de fonctionner à l'identique sous le standard GitHub sans aucune action requise de l'utilisateur.
- **Gain de temps pédagogique** : Création instantanée de dizaines de questions par lot ou par séquence.
- **Adaptabilité pédagogique** : Prise en compte de multiples styles d'évaluation et de conventions de nommage des commits étudiants.
