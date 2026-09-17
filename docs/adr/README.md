# 🏛️ Architecture Decision Records (ADRs)

Ce répertoire contient l'historique formalisé de toutes les décisions d'architecture prises sur **Git4School Visu**.

👉 **[Consulter la Vitrine Complète des ADRs sur le Wiki GitHub](../wiki/Architecture-Decision-Records.md)** (avec diagrammes d'architecture, analyse des patrons de conception et matrice d'impact).

---

## 📑 Index des décisions

| ADR | Titre | Domaine | Statut |
| :---: | :--- | :--- | :---: |
| [0001](./0001-keycap-design-system.md) | Standardisation du composant Keycap dans le Design System | Design System / A11y | `Accepté` |
| [0002](./0002-recherche-et-decouverte-des-depots.md) | Stratégie de recherche et découverte des dépôts GitHub GraphQL | Intégration API / UX | `Accepté` |
| [0003](./0003-gestion-reactive-des-overlays-et-popovers.md) | Gestion réactive et découplée des overlays et popovers (Pub/Sub) | Architecture Réactive | `Accepté` |
| [0004](./0004-strategie-de-cloture-des-questions-et-retrocompatibilite-dexie.md) | Stratégie de clôture des questions, import en masse et rétrocompatibilité Dexie | Modèle Métier / IndexedDB | `Accepté` |
| [0005](./0005-navigation-clavier-typeahead-directive-decouplee.md) | Neutralisation des conflits souris-clavier dans les suggestions Typeahead | Ergonomie UI / Événements | `Accepté` |
| [0006](./0006-authentification-multi-fournisseurs-pattern-strategie.md) | Authentification multi-forges découplée (Pattern Stratégie & Fournisseurs) et OAuth 2.0 PKCE | Sécurité / Architecture SOLID | `Accepté` |

---

## 🧭 Règle pour les contributeurs

Toute décision technique majeure modifiant l'architecture logicielle, les contrats d'API, la persistance ou l'organisation de l'état doit faire l'objet d'un nouvel ADR rédigé selon le standard du projet et répertorié dans la vitrine d'architecture.
