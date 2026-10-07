# 0011 - Placement du filtre de groupe de TP

## Contexte
Le filtre de groupe de TP (`DataService.groupFilter`) s'applique aux quatre vues de premier niveau (Commits, Étudiant·es, Questions, Séances) et persiste d'un onglet à l'autre. Il était cependant rendu par un sélecteur dupliqué dans chaque toolbar de vue, avec des positions divergentes (au milieu de la toolbar des Commits, en tête des autres) et des états visuels légèrement différents. Résultat : en changeant d'onglet, l'utilisateur pouvait ne plus retrouver le contrôle ni repérer qu'un filtre était actif.

## Décision
1. **Sélecteur unique** : le filtre vit dans une *pill de contexte du devoir* dans la navbar, en contrôle segmenté : segment gauche = titre du devoir (bouton unique qui ouvre la configuration, raccourci `C`), segment droit = `TpGroupSelectorComponent` (icône, groupe courant, chevron, compteurs d'étudiant·es par groupe, raccourci `G`). La pill remplace l'ancienne chip du devoir.
2. **Plus de sélecteur dans les toolbars de vue** : les quatre dropdowns natifs sont supprimés. La position du contrôle est désormais identique dans toutes les vues.
3. **État réactif** : `DataService.groupFilter` notifie ses changements via `groupFilter$` ; chaque vue montée s'y abonne et se rafraîchit. La navbar n'a plus de référence directe sur les vues.
4. **Détails d'interaction** : capsule bleue encartée (sans contour) quand un groupe est actif, séparateur effacé dans ce cas, navigation clavier (flèches, Home/End) et `G` en bascule ouverture/fermeture, panneau de largeur ajustée au contenu, entrée/sortie en fondu + échelle ancrée au déclencheur.
5. **Overlays** : le menu se ferme via `OverlayManagerService` (`OverlayType.DROPDOWN`) quand un autre overlay s'ouvre.

## Conséquences
- Un seul point d'ancrage pour le filtre : plus d'incohérence de position, l'état actif est toujours visible dans la navbar.
- Les toolbars de vue ne portent plus que leurs contrôles propres (recherche, curseurs, actions).
- Le filtre est explicitement global : toute nouvelle vue filtrée par groupe devra s'abonner à `groupFilter$` plutôt que de recréer un sélecteur.
- Les deux variantes de prototype (navbar vs. toolbar) et leur harnais (mode dev bar, service de placement, clés i18n `PROTO`) ont été retirés après décision.

## Alternatives écartées
- **Uniformiser le sélecteur en tête de chaque toolbar** : corrigeait la position mais conservait quatre instances dupliquées et laissait le filtre global sans point d'ancrage unique.
- **Barre de contexte dédiée sous la navbar** : coût vertical sur toutes les vues et surface de design plus lourde pour un seul contrôle.
- **Conserver la chip du devoir et ajouter le sélecteur à côté** : deux objets adjacents au rendu incohérent (couture visible), rejeté au profit d'un contrôle segmenté unique.
