# 0010 - Sauvegarde automatique de la configuration d'un devoir

## Contexte
L'édition de la configuration d'un devoir (métadonnées et dépôts) reposait sur un modèle de sauvegarde explicite : un pied de page « Annuler / Sauvegarder », un bandeau « Modifications non enregistrées », une confirmation avant fermeture (`beforeDismiss`) et un garde de navigation (`DataSavedGuard`). Toute modification non validée était perdue à la fermeture, et l'enregistrement d'un formulaire partiellement invalide était bloqué.

Deux contraintes s'opposaient : ne pas écrire en base à chaque frappe clavier, tout en garantissant qu'aucune modification ne soit perdue.

## Décision
1. Suppression de la sauvegarde manuelle (pied de page, bandeau, confirmation de fermeture, garde de navigation) au profit d'une sauvegarde automatique portée par `ConfigurationComponent`.
2. Cadence différenciée :
   - Champs libres (titre, cours, programme, année) : debounce de 600 ms après la dernière frappe.
   - Changements discrets (dates, questions, mode de clôture, durée, dépôts) : persistance immédiate.
3. Garantie de non-perte par « flush » : à la perte de focus, au changement d'onglet, à la fermeture (chevron ou `Échap` en ligne, croix de la modale, clic extérieur) et à la destruction du composant (`ngOnDestroy`). Les sauvegardes concurrentes sont sérialisées et rejouées si de nouvelles modifications arrivent pendant l'écriture.
4. Le titre est un champ obligatoire : il n'est jamais persisté à l'état invalide (le titre valide précédent est conservé). Pour un devoir neuf (`id === -1`), aucun enregistrement n'est créé tant que le titre n'a jamais été valide ; la fermeture d'une carte jamais titrée la supprime.
5. Un indicateur discret dans l'en-tête remplace le bandeau (« Enregistrement… / Enregistré / Titre obligatoire »). À la fermeture, si des données n'ont pas pu être enregistrées (titre invalide), un toast d'erreur explique la cause.
6. Les notifications applicatives (`assignmentModified`) et le rechargement (`repoToLoad`) ne sont déclenchés qu'une fois, à la fermeture, pour ne pas recalculer les graphes à chaque frappe.
7. Les dépôts invalides ou en cours d'édition ne sont jamais persistés (seuls les dépôts validés le sont), conformément au modèle de validation par ligne existant.

## Conséquences
- Aucune perte de saisie : fermer, changer d'onglet ou changer de devoir déclenche un flush.
- Moins de bruit : plus de boutons ni de garde de navigation.
- Limites assumées : un titre vide bloque la création d'un devoir neuf (signalé par un message de champ et un toast à la fermeture) ; l'édition de plusieurs devoirs en parallèle n'est pas supportée (comme auparavant).
- Les graphes et statistiques situés derrière l'éditeur ne se mettent à jour qu'à la fermeture.

## Alternatives écartées
- **Persistance à chaque frappe** : rejetée, trop coûteuse et inutile.
- **Blocage global de la sauvegarde tant que le formulaire est invalide** : rejetée, car elle retarderait des modifications pourtant valides (cours, dates…) saisies au même moment.
- **Conservation d'un bouton « Terminé » pour la modale** : rejetée, la croix existante suffit.
