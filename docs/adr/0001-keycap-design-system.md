# 0001 - Standardisation du composant Keycap dans le Design System

## Contexte
Les touches de raccourcis clavier et indicateurs d'interaction étaient dispersés dans le code avec des implémentations hétérogènes (balises `<span>` vs `<kbd>`, classes locales `.shortcut-badge`, `.cheat-badge`, `.shortcut-key`, styles d'ombres intérieures vs ombres douces, couleurs en dur).

## Décision
1. **Centralisation dans `_components.scss`** : Définir une source unique de vérité sous `kbd, .shortcut-key, .shortcut-badge` reprenant le style épuré de l'aide-mémoire des raccourcis (`ShortcutsModalComponent`).
2. **Sémantique HTML** : Standardiser sur la balise native `<kbd class="shortcut-key">` pour tous les raccourcis clavier réels.
3. **Theming & Dark Mode** : Utiliser exclusivement les tokens CSS globaux (`--color-bg-body`, `--color-border`, `--color-text-primary`, `--color-primary-bg`, `--color-primary`) pour une adaptation automatique aux thèmes clair et sombre sans aucune couleur en dur.
4. **Dimensions & Combos** : Hauteur standard fixée à 22px (arrondis 5px), variante compacte `.shortcut-key-sm` (18px) pour les zones denses, et conteneur `.shortcut-combo` avec séparateur `.key-sep` pour décomposer les combinaisons multi-touches en touches individuelles.
5. **Micro-interactions** : Animation réactive d'appui (`.shortcut-pressed-anim` avec `scale(0.92)` et surbrillance primaire) intégrée nativement.

## Conséquences
- Toute nouvelle touche de raccourci ajoutée dans l'interface doit utiliser la balise `<kbd class="shortcut-key">` ou le conteneur `.shortcut-combo`.
- Les surcharges CSS locales pour les touches de raccourci sont proscrites au profit de la classe globale et de ses modificateurs.
- Le composant `questions-chooser` a été entièrement aligné avec la variante compacte `.shortcut-key-sm` et la gestion centralisée des événements clavier via `OsUtils`.
