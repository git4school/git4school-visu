/**
 * Content of the "What's New" modal.
 *
 * Each release declares the features worth highlighting to users, together with the i18n keys
 * holding their texts. Releases are listed most recent first: the modal highlights the one
 * matching the running version and keeps the older ones available in a history panel.
 */

export type WhatsNewTag = "new" | "improved";

export interface WhatsNewFeature {
  /** FontAwesome solid icon class, for example `fa-chart-line`. */
  icon: string;
  tag: WhatsNewTag;
  /** i18n key of the feature name. */
  titleKey: string;
  /** i18n key of the one or two sentence description. */
  descriptionKey: string;
  /** i18n key of the "where to find it" hint, omitted for compact history entries. */
  hintKey?: string;
  /** Illustration path relative to the application root, or undefined for a text-only feature. */
  image?: string;
  /** i18n key of the illustration alternative text. */
  imageAltKey?: string;
}

export interface WhatsNewRelease {
  /** Version matching `environment.version`. */
  version: string;
  /** i18n key segment of the release. It must not contain dots, which would break i18n paths. */
  slug: string;
  /** i18n key of the release summary shown under the title. */
  summaryKey: string;
  /** i18n key of the localized release date. */
  dateKey: string;
  features: WhatsNewFeature[];
}

/** Root i18n key holding every text of the modal. */
export const WHATS_NEW_I18N_ROOT = "WHATS-NEW";

/** Folder holding the release illustrations, relative to the application root. */
const MEDIA_FOLDER = "assets/images/whats-new";

interface WhatsNewFeatureSeed {
  /** i18n key segment of the feature, unique within its release. */
  id: string;
  icon: string;
  tag: WhatsNewTag;
  /** Illustration file name inside the release folder, or undefined for a text-only feature. */
  image?: string;
  /** Whether the feature declares a "where to find it" hint, omitted by compact history entries. */
  hint?: boolean;
}

/**
 * Builds the i18n keys and the illustration paths of a release from compact seeds.
 *
 * @param version Version of the release, used as the illustration folder name.
 * @param slug i18n key segment of the release.
 * @param seeds Features to declare, in display order.
 */
function buildFeatures(version: string, slug: string, seeds: WhatsNewFeatureSeed[]): WhatsNewFeature[] {
  return seeds.map((seed) => {
    const baseKey = `${WHATS_NEW_I18N_ROOT}.RELEASES.${slug}.FEATURES.${seed.id}`;
    return {
      icon: seed.icon,
      tag: seed.tag,
      titleKey: `${baseKey}.TITLE`,
      descriptionKey: `${baseKey}.DESC`,
      image: seed.image ? `${MEDIA_FOLDER}/${version}/${seed.image}` : undefined,
      imageAltKey: seed.image ? `${baseKey}.ALT` : undefined,
      hintKey: seed.hint ? `${baseKey}.HINT` : undefined,
    };
  });
}

/**
 * Builds a release declaration from compact feature seeds.
 *
 * @param version Version matching `environment.version`.
 * @param slug i18n key segment of the release, without dots.
 * @param seeds Features to declare, in display order.
 */
function buildRelease(version: string, slug: string, seeds: WhatsNewFeatureSeed[]): WhatsNewRelease {
  const baseKey = `${WHATS_NEW_I18N_ROOT}.RELEASES.${slug}`;
  return {
    version,
    slug,
    summaryKey: `${baseKey}.SUMMARY`,
    dateKey: `${baseKey}.DATE`,
    features: buildFeatures(version, slug, seeds),
  };
}

/**
 * Releases documented in the modal, most recent first.
 */
export const WHATS_NEW_RELEASES: WhatsNewRelease[] = [
  buildRelease("2.7.0", "V2-7-0", [
    { id: "SESSIONS-VIEW", icon: "fa-chart-line", tag: "new", image: "sessions-view.png", hint: true },
    { id: "LIVE-SESSION", icon: "fa-satellite-dish", tag: "new", image: "live-session.png", hint: true },
    { id: "FOLDER-VIEW", icon: "fa-folder-open", tag: "new", image: "folder-view.png", hint: true },
    { id: "NOW-MARKER", icon: "fa-clock", tag: "new", hint: true },
    { id: "QUICK-ACTIONS", icon: "fa-copy", tag: "new", image: "quick-actions.png", hint: true },
    { id: "AUTOSAVE", icon: "fa-save", tag: "new", hint: true },
    { id: "TP-GROUP-FILTER", icon: "fa-filter", tag: "improved", hint: true },
    { id: "GRAPH-INTERACTIONS", icon: "fa-mouse-pointer", tag: "improved", hint: true },
  ]),
  buildRelease("2.6.0", "V2-6-0", [
    { id: "HOSTED-GITLAB", icon: "fa-server", tag: "new" },
    { id: "TOKEN-REFRESH", icon: "fa-sync", tag: "new" },
    { id: "TOKEN-STATUS", icon: "fa-key", tag: "new" },
    { id: "ANONYMOUS-MODE", icon: "fa-user-secret", tag: "new" },
    { id: "SEARCH-BAR", icon: "fa-search", tag: "improved" },
    { id: "STUDENT-REPOS", icon: "fa-code-branch", tag: "new" },
  ]),
];
