import { Assignment } from "@models/Assignment.model";
import { Utils } from "@services/utils";

/**
 * Suffixe d'une copie : « TP (2) ». Le groupe 1 est la base, le groupe 2 l'indice.
 * Le `\s*` tolère un titre saisi avec une espace parasite avant la parenthèse.
 */
const COPY_SUFFIX_PATTERN = /^(.*?)\s*\((\d+)\)$/;

/**
 * Duplication d'un devoir : titre suffixé « (n) » et champs pédagogiques recopiés.
 *
 * Les dépôts, l'année, les dates, les jalons, les séances et la date d'archivage ne sont
 * jamais copiés : la copie démarre une nouvelle période et ne doit rien afficher du devoir
 * d'origine tant que celui-ci n'a pas été rechargé.
 */

/** Normalise un titre pour les comparaisons (casse et espaces ignorés). */
function normalizeTitle(title: string): string {
  return (title || "").trim().toLowerCase();
}

/** Retire une occurrence du titre (comparaison normalisée), pour ignorer la source elle-même. */
function withoutFirstOccurrence(titles: string[], title: string): string[] {
  const target = normalizeTitle(title);
  let removed = false;
  return titles.filter((candidate) => {
    if (!removed && normalizeTitle(candidate) === target) {
      removed = true;
      return false;
    }
    return true;
  });
}

/** Indice de copie porté par un titre, ou `null` si le titre ne finit pas par « (n) ». */
function copyIndex(title: string): { base: string; index: number } | null {
  const match = COPY_SUFFIX_PATTERN.exec((title || "").trim());
  if (!match) {
    return null;
  }
  const base = match[1].trim();
  if (!base) {
    return null;
  }
  return { base, index: Number(match[2]) };
}

/**
 * Base de travail d'un titre : le suffixe « (n) » n'est retiré que si le titre appartient
 * déjà à une famille de copies (« TP », « TP (1) »… avec « TP (1) » qui descend de « TP »).
 * Un titre isolé comme « TP (2026) » reste donc sa propre base, sinon sa copie deviendrait
 * « TP (2027) » — une année au lieu d'un numéro de copie.
 */
function resolveTitleBase(title: string, existingTitles: string[]): string {
  const parsed = copyIndex(title);
  if (!parsed) {
    return title;
  }
  const normalizedBase = normalizeTitle(parsed.base);
  const others = withoutFirstOccurrence(existingTitles, title);
  const belongsToCopyFamily = others.some((candidate) => {
    if (normalizeTitle(candidate) === normalizedBase) {
      return true;
    }
    const sibling = copyIndex(candidate);
    return sibling !== null && normalizeTitle(sibling.base) === normalizedBase;
  });
  return belongsToCopyFamily ? parsed.base : title;
}

/** Premier indice de copie libre pour cette base (1 s'il n'existe encore aucune copie). */
function nextCopyIndex(base: string, existingTitles: string[]): number {
  const normalizedBase = normalizeTitle(base);
  let highest = 0;
  existingTitles.forEach((title) => {
    const parsed = copyIndex(title);
    if (parsed !== null && normalizeTitle(parsed.base) === normalizedBase) {
      highest = Math.max(highest, parsed.index);
    }
  });
  return highest + 1;
}

/**
 * Titre de la copie d'un devoir : « TP » → « TP (1) », « TP (1) » → « TP (2) ».
 *
 * @param sourceTitle titre du devoir dupliqué
 * @param existingTitles titres de tous les devoirs existants (archivés compris, source
 * comprise) : les indices déjà pris ne sont jamais réutilisés
 */
export function buildDuplicateTitle(sourceTitle: string, existingTitles: string[] = []): string {
  const title = (sourceTitle || "").trim();
  if (!title) {
    return title;
  }
  const base = resolveTitleBase(title, existingTitles);
  return `${base} (${nextCopyIndex(base, existingTitles)})`;
}

/**
 * Construit la copie d'un devoir prête à être persistée (sans identifiant) : même forge,
 * titre suffixé, cours, programme, questions, options de clôture et durée de séance par
 * défaut. Voir le commentaire de tête pour tout ce qui n'est volontairement pas copié.
 */
export function buildDuplicateAssignment(source: Assignment, existingTitles: string[] = []): Assignment {
  const copy = new Assignment();
  copy.provider = source.provider;
  copy.instanceHost = source.instanceHost;
  copy.instanceName = source.instanceName;
  copy.title = buildDuplicateTitle(source.title, existingTitles);
  copy.course = source.course;
  copy.program = source.program;
  copy.questions = [...(source.questions || [])];
  copy.closingMode = source.closingMode;
  copy.customClosingKeywords = [...(source.customClosingKeywords || [])];
  copy.defaultSessionDuration = { ...(source.defaultSessionDuration || Utils.DEFAULT_SESSION_DURATION) };
  return copy;
}
