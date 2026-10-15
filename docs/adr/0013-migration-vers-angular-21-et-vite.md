# 0013 - Migration vers Angular 21 LTS et l'outillage de build Vite/esbuild

## Contexte
Le projet tournait sur **Angular 11.0.6** (décembre 2020) avec le build **webpack** (`@angular-devkit/build-angular:browser`), Node 16, TypeScript 4.0 et rxjs 6. Le support webpack d'Angular est désormais **déprécié** au profit de `@angular/build` (build **esbuild**, serveur de développement **Vite**). Or aucun support de Vite n'existe pour Angular 11 : la montée de version d'Angular était le prérequis incontournable.

## Décision
1. **Montée incrémentale Angular 11 → 21 LTS**, une version majeure à la fois, avec `build` + `tests` verts à chaque saut (un commit par saut).
2. **Node 16 jusqu'à Angular 16**, puis **bascule sur Node 24 LTS** (`.nvmrc`, champ `engines`), Angular 17+ exigeant Node ≥ 18.
3. **Bascule du builder** `build`/`serve` vers **`@angular/build:application`** (build esbuild) et **`@angular/build:dev-server`** (Vite). Port de développement inchangé (**4200**, pour préserver les `redirectUri` OAuth).
4. Le **runner de tests reste Karma** (`@angular-devkit/build-angular:karma`) ; la migration vers Vitest est reportée (hors périmètre « dev + production »).
5. **Adaptations d'interopérabilité esbuild** : `moment` importé par défaut (`import moment from "moment"`, plus de `import * as`) ; `require("../../package.json")` remplacé par un import JSON ; suppression de l'import Node `assert` ; polyfills `zone.js` via le point d'entrée moderne ; `allowSyntheticDefaultImports`.
6. **Montée de l'outillage lint** (ESLint 8, `typescript-eslint` 8, `@angular-eslint` 21) pour supporter TypeScript 5.9 ; ajout de `resolutions` (`caniuse-lite`) ; `@angular/build` ajouté en devDependency.

## Conséquences
- `ng build` (esbuild, ~12 s) et `ng serve` (**Vite**) ; plus aucune dépendance **webpack** sur le chemin build/serve.
- **Node 24 LTS** requis ; le drapeau `NODE_OPTIONS=--openssl-legacy-provider` (ancien webpack 4) devient inutile.
- **Tests : 330/330** sur Karma.
- Dette restante assumée : `firebase` 7 (CommonJS non modulaire), `rxjs` 6 → 7, migration des tests vers Vitest, stylelint préexistant non vert. Les avertissements esbuild CommonJS sont silencés via `allowedCommonJsDependencies` ; les dépréciations Dart Sass `@import` sont silencées via `stylePreprocessorOptions.sass.silenceDeprecations` (les global built-ins et la division `/` ont, eux, été corrigés ; une migration vers `@use` reste à planifier).
- Sortie de build conservée à `dist/git4school` (via `outputPath: { base, browser: "" }`) pour ne pas casser l'hébergement Firebase.

## Alternatives écartées
- **Analog (`@analogjs/vite-plugin-angular`)** pour un Vite *de production* : exige Angular 17+ et ajoute une dépendance communautaire ; le builder officiel `@angular/build` couvre le besoin (Vite en dev, esbuild en prod).
- **Saut direct de versions majeures** : impossible, `ng update` impose une progression major par major.
- **Rester sur webpack** : outillage déprécié, hors support.
