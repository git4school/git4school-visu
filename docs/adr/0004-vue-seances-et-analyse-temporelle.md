# 0004 - Vue Séances, Tolérance Adaptative et Visualisation de Progression

## Contexte
L'application Git4School permettait de configurer des séances de TP et d'en visualiser les plages horaires sur la timeline globale (`OverviewComponent`), mais ne proposait aucune vue analytique dédiée pour évaluer la dynamique pédagogique d'une séance (taux d'engagement, cadence de commits, progression sur les questions, travail en séance vs autonome). De plus, l'attribution stricte des commits aux créneaux horaires risquait de fausser les statistiques en excluant les vagues collectives de commits poussées à la sonnerie de fin de séance.

## Décision
1. **Architecture Hybride (Macro / Micro)** :
   - Ajout d'un 4ème onglet de premier niveau `/sessions` (raccourci clavier `4`, icône SVG de calendrier de séance).
   - Double mode de consultation : une vue d'ensemble comparant l'ensemble des séances du devoir (KPIs globaux, comparatif d'effort et cartes interactives) et une vue détaillée par séance accessible via un ruban de pilules (`pill tabs`) et des cartes cliquables.
2. **Tolérance Adaptative Continue (Dynamic Session Grace Period)** :
   - Intégration d'une marge de base incompressible de 3 minutes post-séance pour absorber le délai naturel de rendu sans condition.
   - Prolongation continue conditionnée par la densité collective : la fenêtre s'étend tant que des étudiants distincts continuent de commiter sans interruption de plus de 4 minutes, jusqu'à un plafond de sécurité de 30 minutes. Un badge explicatif informe l'utilisateur de l'extension accordée.
3. **Bande de Dispersion de Progression (Cohort Progress Ribbon)** :
   - Représentation D3.js combinant la courbe médiane de progression de la promotion et un ruban ombré d'intervalle interquartile (25e - 75e percentile).
   - Mode commutable par bouton bascule entre progression conceptuelle (questions résolues) et intensité de code (commits cumulés).
4. **Détection Semi-Automatique des Séances** :
   - Algorithme de détection des pics d'activité synchrones exploitant la durée de séance par défaut (`defaultSessionDuration`) configurée dans les métadonnées pour suggérer des créneaux validables par l'enseignant.
5. **Indicateur de Progression des Calculs** :
   - Intégration d'un loader dédié affichant l'état d'avancement du traitement des métriques lors du chargement de la vue.

## Conséquences
- Les calculs d'appartenance des commits à une séance deviennent dynamiques et sensibles à la dynamique collective.
- La documentation de domaine dans `CONTEXT.md` s'enrichit des concepts formalisés (*Séance*, *Présence active*, *Tolérance adaptative*, *Bande de dispersion*, *Séance suggérée*).
