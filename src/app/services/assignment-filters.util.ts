import { GitProviderType } from "@models/GitAuthProvider.model";

/**
 * Pure helpers behind the assignment chooser filters (home view).
 *
 * They are intentionally free of Angular: the component only forwards its state, which keeps the
 * filtering rules testable and lets the "provider pills" be built from plain data.
 */

/** Filter pill shown above the assignment list (one per provider/instance, plus "all" and "archived"). */
export interface ProviderFilterPill {
  key: string;
  label: string;
  provider?: GitProviderType;
  instanceHost?: string;
  instanceName?: string;
  isCustom?: boolean;
}

/** Advanced filters of the home toolbar. */
export interface AssignmentAdvancedFilters {
  status: {
    prepared: boolean;
    ongoing: boolean;
    finished: boolean;
    default: boolean;
  };
  course: string;
  program: string;
  year: string;
}

/** Fields of the advanced filters that are single-value dropdowns. */
export type AssignmentDropdownField = "course" | "program" | "year";

/** Filters state needed to compute the displayed assignments. */
export interface AssignmentFilterState {
  filterType: string;
  searchQuery: string;
  advancedFilters: AssignmentAdvancedFilters;
}

/** A creation draft (not persisted yet) must always stay visible, whatever the filters are. */
const isDraft = (assignment: any): boolean => assignment?.id === -1;

/** Archived assignment: only listed in the "Archived" pill. */
export function isArchivedAssignment(assignment: any): boolean {
  return Boolean(assignment?.archivedAt);
}

/** Computes the assignments shown in the list, applying the pill, the search and the advanced filters. */
export function filterAssignments(assignments: any[], state: AssignmentFilterState): any[] {
  let result = applyTypeFilter(assignments, state.filterType);
  result = applySearchFilter(result, state.searchQuery);
  return applyAdvancedFilters(result, state.advancedFilters);
}

/** Number of active advanced filters, shown as a badge on the filter button. */
export function countActiveFilters(filters: AssignmentAdvancedFilters): number {
  let count = 0;
  const status = filters.status;
  if (!status.prepared || !status.ongoing || !status.finished || !status.default) {
    count++;
  }
  if (filters.course) {
    count++;
  }
  if (filters.program) {
    count++;
  }
  if (filters.year) {
    count++;
  }
  return count;
}

/** Turns a host URL into a readable instance name (`https://gitlab.example.com/` → `example.com`). */
export function cleanHostname(host: string): string {
  return host
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/^gitlab\./, "")
    .replace(/\/$/, "");
}

/**
 * Builds the provider pills: always "all" first, then one pill per provider actually in use
 * (connected account or existing assignment), and "archived" last so a pill never appears/disappears.
 */
export function buildProviderFilterPills(input: {
  assignments: any[];
  isGithubConnected: boolean;
  isGitlabConnected: boolean;
  customAccounts: Array<{ instanceHost?: string; instanceName?: string }>;
  hasAccountForHost: (provider: GitProviderType, host: string) => boolean;
}): ProviderFilterPill[] {
  const assignments = input.assignments || [];
  const pills: ProviderFilterPill[] = [{ key: "all", label: "HOME.FILTER.ALL" }];

  if (input.isGithubConnected || assignments.some((a) => !a.provider || a.provider === "github")) {
    pills.push({ key: "github", label: "HOME.FILTER.GITHUB", provider: "github", instanceHost: "github.com" });
  }

  const isGitlabCloud = (a: any): boolean =>
    a.provider === "gitlab" && (!a.instanceHost || a.instanceHost === "gitlab.com" || a.resolvedInstanceHost === "gitlab.com");

  if (input.isGitlabConnected || assignments.some(isGitlabCloud)) {
    pills.push({ key: "gitlab", label: "HOME.FILTER.GITLAB", provider: "gitlab", instanceHost: "gitlab.com" });
  }

  buildCustomHostPills(input).forEach((pill) => pills.push(pill));

  /* Toujours visible, en dernière position : un onglet qui apparaît/disparaît selon les
     données serait plus déroutant qu'un onglet vide. */
  pills.push({ key: "archived", label: "HOME.FILTER.ARCHIVED" });

  return pills;
}

/** One pill per self-hosted GitLab instance, connected or referenced by an assignment. */
function buildCustomHostPills(input: {
  assignments: any[];
  customAccounts: Array<{ instanceHost?: string; instanceName?: string }>;
  hasAccountForHost: (provider: GitProviderType, host: string) => boolean;
}): ProviderFilterPill[] {
  const hosts = new Map<string, { name: string; isConnected: boolean }>();

  (input.customAccounts || []).forEach((account) => {
    if (account.instanceHost) {
      hosts.set(account.instanceHost, {
        name: account.instanceName || cleanHostname(account.instanceHost),
        isConnected: true,
      });
    }
  });

  (input.assignments || []).forEach((assignment) => {
    const host =
      assignment.instanceHost ||
      (assignment.provider === "gitlab" && assignment.resolvedInstanceHost !== "gitlab.com" ? assignment.resolvedInstanceHost : null);
    if (assignment.provider === "gitlab" && host && host !== "gitlab.com" && !hosts.has(host)) {
      hosts.set(host, {
        name: assignment.instanceName || cleanHostname(host),
        isConnected: input.hasAccountForHost("gitlab", host),
      });
    }
  });

  return Array.from(hosts.entries()).map(([host, info]) => ({
    key: `gitlab:${host}`,
    label: `GitLab (${info.name})`,
    provider: "gitlab" as GitProviderType,
    instanceHost: host,
    instanceName: info.name,
    isCustom: true,
  }));
}

/** Applies the selected pill (all / provider / custom instance / archived). */
function applyTypeFilter(assignments: any[], filterType: string): any[] {
  if (filterType === "archived") {
    return assignments.filter((a) => isDraft(a) || isArchivedAssignment(a));
  }

  /* Les devoirs archivés ne sont visibles que dans l'onglet « Archivés ». */
  const visible = assignments.filter((a) => isDraft(a) || !isArchivedAssignment(a));

  if (filterType === "github") {
    return visible.filter((a) => isDraft(a) || !a.provider || a.provider === "github");
  }
  if (filterType === "gitlab" || filterType === "gitlab-cloud") {
    return visible.filter(
      (a) =>
        isDraft(a) ||
        (a.provider === "gitlab" && (!a.instanceHost || a.instanceHost === "gitlab.com" || a.resolvedInstanceHost === "gitlab.com")),
    );
  }
  if (filterType.startsWith("gitlab:")) {
    const targetHost = filterType.substring(7);
    return visible.filter(
      (a) => isDraft(a) || (a.provider === "gitlab" && (a.instanceHost === targetHost || a.resolvedInstanceHost === targetHost)),
    );
  }
  if (filterType !== "all") {
    return visible.filter((a) => a.uiType === filterType || isDraft(a));
  }
  return visible;
}

/** Free-text search on the metadata of an assignment. */
function applySearchFilter(assignments: any[], searchQuery: string): any[] {
  if (!searchQuery || searchQuery.trim() === "") {
    return assignments;
  }

  const query = searchQuery.toLowerCase().trim();
  return assignments.filter(
    (a) =>
      isDraft(a) ||
      (a.title && a.title.toLowerCase().includes(query)) ||
      (a.course && a.course.toLowerCase().includes(query)) ||
      (a.program && a.program.toLowerCase().includes(query)) ||
      (a.year && a.year.toLowerCase().includes(query)),
  );
}

/** Applies the status/course/program/year filters of the advanced panel. */
function applyAdvancedFilters(assignments: any[], filters: AssignmentAdvancedFilters): any[] {
  const statusFilters = filters.status;
  const isAnyStatusFilterActive = statusFilters.prepared || statusFilters.ongoing || statusFilters.finished || statusFilters.default;
  let result = assignments;

  if (isAnyStatusFilterActive) {
    result = result.filter((a) => isDraft(a) || Boolean(statusFilters[a.uiStatus as keyof typeof statusFilters]));
  }
  if (filters.course) {
    result = result.filter((a) => isDraft(a) || a.course === filters.course);
  }
  if (filters.program) {
    result = result.filter((a) => isDraft(a) || a.program === filters.program);
  }
  if (filters.year) {
    result = result.filter((a) => isDraft(a) || a.year === filters.year);
  }

  return result;
}
