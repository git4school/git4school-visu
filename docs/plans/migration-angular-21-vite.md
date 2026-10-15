# Plan de migration — Angular 21 LTS & outillage Vite

> Statut : **Réalisé**. Décision enregistrée dans l'ADR [`0013`](../adr/0013-migration-vers-angular-21-et-vite.md).

---

## 1. Contexte

- **État actuel** : Angular **11.0.6** (décembre 2020), build **webpack** via `@angular-devkit/build-angular:browser`, TypeScript 4.0, rxjs 6.5, zone.js 0.10.
- **Runtime** : Node **16.19.0** (imposé par `AGENTS.md`), alors que l'outillage Angular moderne exige `^22.22.2 || ^24.15.0 || >=26.0.0` (constaté : `ng update` échoue sur Node 16).
- **Tests** : Karma 5.1 + Jasmine 3.6, **330 specs**. Protractor/e2e a été retiré (commit `85c708d`).
- **Nettoyage déjà fait** (commit `85c708d`) : 37 paquets inutilisés supprimés (chart.js, ngx-*, ng2-charts, ngx-datatable, fortawesome, rxjs-compat, core-js, bootstrap/jquery/popper…). Ces suppressions lèvent plusieurs obstacles de la migration.
- **Constat structurant** : le support **webpack d'Angular est déprécié** ; la cible officielle est le paquet `@angular/build` (build **esbuild** + serveur de dev **Vite**). **Rien de spécifiquement Vite n'est possible avant Angular 17+** : l'upgrade Angular est le chemin critique.

## 2. Objectifs / Non-objectifs

**Objectifs**
1. Passer à **Angular 21 LTS**.
2. Adopter le builder **`@angular/build:application`** (build esbuild, `ng serve` sur **Vite**).
3. Passer le runtime à **Node 24 LTS**.
4. Migrer les tests vers le runner moderne (Vitest ou runner Angular 21) et supprimer Karma.

**Non-objectifs (hors périmètre)**
- SSR / rendu hybride.
- Adoption d'**Analog** comme bundler de production (décision ultérieure, cf. §9).
- Toute évolution fonctionnelle ou refonte UI.
- Migration e2e (le choix Playwright/Cypress reste ouvert).

## 3. Décisions proposées

| Sujet | Décision |
| :--- | :--- |
| Version cible | **Angular 21 LTS** |
| Node cible | **24 LTS** (bascule depuis Node 16 à partir d'Angular 17) |
| Stratégie | **Montée incrémentale**, un saut majeur à la fois, **build + tests verts à chaque saut** |
| Builder final | **`@angular/build:application`** (Vite dev server + esbuild) — Analog en option |
| Bundler produit | esbuild (Vite n'est, par défaut, que le **serveur de dev**) |

## 4. Principes d'exécution

1. **Un saut = une branche** `upgrade/ngNN` + un commit dédié (revert/bisect faciles).
2. S'appuyer sur `ng update` et sur le **Angular Update Guide** (update.angular.io) pour chaque paire de versions.
3. **Monter les libs tierces en lockstep** : on installe la version dont le `peerDependencies` cible la majeure Angular atteinte (vérifier les peer ranges, ne pas se fier à la mémoire).
4. **Ne jamais mélanger** une montée Angular et un changement de bundler.
5. À chaque saut : `yarn lint`, `yarn lint:scss`, `yarn build-prod`, `yarn test --watch=false`, + un smoke test live (mode démo de la dev bar).
6. Conserver un **tag de sauvegarde** avant chaque saut.

## 5. Matrice de compatibilité (Node / TypeScript)

Le CLI impose sa version de Node et de TypeScript. Repères (à confirmer sur les `engines` du CLI de chaque majeure) :

| Saut | Majeure Angular | Node requis | Remarque |
| :---: | :---: | :--- | :--- |
| 1 | 12 | ^12.14 \|\| ^14.15 \|\| **16** | TS 4.2, tslib ^2.3, zone.js ~0.11 |
| 2 | 13 | ^12.20 \|\| ^14.15 \|\| **16** | TS 4.4 |
| 3 | 14 | ^14.15 \|\| **16** | TS 4.6 |
| 4 | 15 | ^14.20 \|\| **16.13** \|\| ^18.10 | TS 4.8 |
| 5 | 16 | ^**16.14** \|\| ^18.10 | dernier saut sur Node 16 |
| 6 | **17** | ^18.13 \|\| ^20.9 | **bascule Node 24** ; 1ʳᵉ version avec `@angular/build` |
| 7 | 18 | ^18.19 \|\| ^20.11 | |
| 8 | 19 | ^18.19 \|\| ^20.11 \|\| ^22 | runner de tests moderne |
| 9 | 20 | ^20.19 \|\| ^22.12 \|\| **^24** | Vite par défaut côté `ng serve` |
| 10 | **21** | ^20.19 \|\| ^22.12 \|\| **^24** | cible |

> Les sauts 6→10 sont « de confort » : le gain Vite est acquis dès le saut 6. Les sauts 7→10 peuvent être menés **après** la bascule builder si l'on veut sécuriser le gain plus tôt.

## 6. Plan par phases

### Phase 0 — Préparation (aucun impact fonctionnel)
- Installer **Node 24 LTS** en parallèle (`nvm install 24`), conserver **16** par défaut pour l'instant.
- Hygiène transverse à faire une fois :
  - `src/environments/environment*.ts` : remplacer `require("../../package.json")` par un `import` (l'import JSON est déjà activé via `resolveJsonModule`).
  - Mettre à jour `AGENTS.md` : retirer la consigne `NODE_OPTIONS=--openssl-legacy-provider` (invalide sur Node 16, cf. §8) et documenter la stratégie Node.
- Retirer `reflect-metadata` de `main.ts` (aucun usage de `Reflect.`, AOT actif) — à valider par un build + tests.

### Phase 1 — Sauts 11 → 16 (sur Node 16)
- Boucle : `npx ng update @angular/core@NN @angular/cli@NN` puis montée des libs tierces bloquantes.
- Libs à monter au fil des sauts : `@ng-bootstrap/ng-bootstrap`, `@ngx-translate/core` + `http-loader`, `rxjs` (6 → 7, désormais possible sans `rxjs-compat`), `zone.js`, `class-transformer` (0.3 → 0.5), `firebase` (voir §7), `typescript` (piloté par `ng update`).
- Le code applicatif est déjà Ivy + AOT : peu de migrations de templates attendues.

### Phase 2 — Bascule Node & saut 16 → 17
- `nvm use 24` (et `.nvmrc` → `24`).
- `ng update @angular/core@17 @angular/cli@17` + `@angular-devkit/build-angular@17`.
- C'est ici que `@angular/build` devient disponible.

### Phase 3 — Bascule du builder (le « passage à Vite »)
- Remplacer le builder de `build` :
  `@angular-devkit/build-angular:browser` → **`@angular/build:application`**.
- Alternative à moindre risque : `@angular-devkit/build-angular:browser-esbuild` (renommage quasi seul).
- `ng serve` utilise alors **Vite** comme serveur de dev (port 4200 conservé : les `redirectUri` OAuth ne changent pas).

### Phase 4 — Adaptations spécifiques Vite
| Point | Action |
| :--- | :--- |
| Variables d'environnement | `fileReplacements` (prod/dev) → configurations de build / `define` si besoin |
| `require("../../package.json")` | déjà réglé en Phase 0 |
| SCSS `includePaths` | reporter dans les options du builder (`stylePreprocessorOptions` conservé, ou `css.preprocessorOptions` si Analog) |
| Alias tsconfig (`@services/*`…) | pris en charge par le builder ; sinon `resolve.alias` |
| Polyfills | `src/polyfills.ts` → option `polyfills` du builder (conserver `zone.js`, `@angular/localize/init`) |
| Script global CDN (FontAwesome) | inchangé (`index.html`) |
| Dépendances CommonJS | surveiller les avertissements esbuild (ex. `Repository.model.ts` → `assert`) |
| `NODE_OPTIONS=--openssl-legacy-provider` | à retirer (n'a de sens que pour webpack 4 sous Node 17+) |

### Phase 5 — Tests
- Migrer Karma/Jasmine vers **Vitest** (recommandé avec la stack Vite) ou le runner de test Angular 21.
- Convertir `src/test.ts` (`require.context` = webpack-isme) → `import.meta.glob`.
- Supprimer `src/karma.conf.js` et les paquets `karma-*`.

### Phase 6 — Finalisation
- Mettre à jour `AGENTS.md`, `README.md`, `CHANGELOG.md`.
- Rédiger l'ADR `0013` (statut `Accepté`) et l'ajouter à l'index `docs/adr/README.md`.
- Nettoyer les dépendances devenues inutiles après chaque phase (`@angular-devkit/build-angular` si totalement remplacé).
- Vérifier la CI (`.github/`).

## 7. Risques & mitigations

| Risque | Impact | Mitigation |
| :--- | :--- | :--- |
| `firebase` 7 → API modulaire (9/10) | **Élevé** — réécriture des appels | Isoler dans un service dédié ; saut dédié ; envisager de geler firebase à la majeure compatible la plus haute avant le passage modulaire |
| `@ng-bootstrap/ng-bootstrap` 8 → courant | Moyen | Monter version par version ; vérifier templates/directives |
| `@ngx-translate` 12 → courant | Moyen | API proche ; vérifier `TranslateHttpLoader` |
| `moment` (locales, formats) | Moyen | Envisager `dayjs` ou `Intl` (24 usages) — décision séparée |
| `class-transformer` 0.3 → 0.5 | Moyen | Vérifier la sérialisation Dexie (`@Type`, `plainToClass`) |
| `rxjs` 6 → 7 | Moyen | Dépréciations ; `rxjs-compat` déjà retiré ✅ |
| TypeScript 4 → 5 | Moyen | Nouvelles erreurs de typage à corriger |
| Tests Karma → Vitest | Moyen | `require.context` à convertir ; API Jasmine≍Vitest |
| Builder webpack → esbuild | Faible/Moyen | Avertissements CommonJS ; budgets SCSS (déjà en warning) |
| Contrainte `engines` (`node-releases@2.0.55`) | Faible | `yarn install --ignore-engines`, résolu par la bascule Node |
| `dexie` 3 → 4 | Faible | Non bloquant ; hors périmètre sauf besoin |

## 8. Vérification (à chaque saut)

```sh
nvm use 16          # jusqu'au saut 16 ; ensuite nvm use 24
yarn lint
yarn lint:scss
yarn build-prod     # PAS de NODE_OPTIONS=--openssl-legacy-provider sur Node 16
yarn test --watch=false --browsers=ChromeHeadless
```
Plus un smoke test live (`yarn start` + mode démo de la dev bar). Critère : **0 erreur de lint, build OK, 330/330 tests**.

## 9. Points ouverts (à trancher)

1. **Vitest** vs runner de test Angular 21 — Vitest s'intègre mieux à la stack Vite.
2. **Builder officiel** vs **Analog** (`@analogjs/vite-plugin-angular`) pour un Vite *de production* (Analog exige Angular 17+).
3. **moment** → `dayjs`/`Intl` : maintenant, plus tard, ou jamais ?
4. **firebase** : monter en modulaire pendant la montée, ou figer puis traiter à part ?
5. Faut-il basculer le builder **dès Angular 17** (gain rapide) ou attendre 21 (moins de sauts) ?

## 10. Definition of Done

- Angular **21 LTS**, Node **24 LTS**, builder **`@angular/build:application`**.
- `ng build` (esbuild) et `ng serve` (Vite) fonctionnels ; plus aucune dépendance webpack.
- Tests migrés et verts ; Karma supprimé.
- `AGENTS.md`, ADR `0013` et index ADR à jour.

## 11. Modèle de checklist par saut

```
[ ] Branche upgrade/ngNN créée + tag de sauvegarde
[ ] npx ng update @angular/core@NN @angular/cli@NN
[ ] Libs tierces montées (peers vérifiés)
[ ] yarn lint / lint:scss OK
[ ] yarn build-prod OK
[ ] yarn test --watch=false → 330/330
[ ] Smoke test live (mode démo)
[ ] Commit (message oneline + gitmoji)
```
