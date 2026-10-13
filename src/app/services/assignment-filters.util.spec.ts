import { AssignmentAdvancedFilters, buildProviderFilterPills, cleanHostname, countActiveFilters, filterAssignments, isArchivedAssignment } from "./assignment-filters.util";

describe("assignment-filters.util", () => {
  const allStatuses = { status: { prepared: true, ongoing: true, finished: true, default: true }, course: "", program: "", year: "" };

  const draft = { id: -1, title: "brouillon" };
  const archived = { id: 1, title: "archivé", archivedAt: new Date(), uiStatus: "finished" };
  const github = { id: 2, title: "TP1", course: "GLA", program: "M1", year: "2026", uiStatus: "ongoing", provider: "github" };
  const gitlabCloud = { id: 3, title: "TP2", course: "GLA", program: "M2", year: "2025", uiStatus: "prepared", provider: "gitlab" };
  const gitlabCustom = {
    id: 4,
    title: "TP3",
    course: "ASR",
    program: "M1",
    year: "2026",
    uiStatus: "default",
    provider: "gitlab",
    instanceHost: "gitlab.example.com",
  };
  const assignments = [draft, archived, github, gitlabCloud, gitlabCustom];

  const filter = (filterType: string, searchQuery = "", advancedFilters: AssignmentAdvancedFilters = allStatuses) =>
    filterAssignments(assignments, { filterType, searchQuery, advancedFilters }).map((a) => a.id);

  describe("isArchivedAssignment", () => {
    it("should only consider assignments with an archiving date", () => {
      expect(isArchivedAssignment(archived)).toBeTrue();
      expect(isArchivedAssignment(github)).toBeFalse();
      expect(isArchivedAssignment(null)).toBeFalse();
    });
  });

  describe("filterAssignments", () => {
    it("should hide archived assignments from every pill but « Archivés »", () => {
      expect(filter("all")).toEqual([-1, 2, 3, 4]);
      expect(filter("github")).toEqual([-1, 2]);
      expect(filter("gitlab")).toEqual([-1, 3]);
      expect(filter("gitlab:gitlab.example.com")).toEqual([-1, 4]);
      expect(filter("archived")).toEqual([-1, 1]);
    });

    it("should always keep the creation draft visible", () => {
      expect(filter("gitlab:gitlab.example.com", "TP1")).toContain(-1);
    });

    it("should search the title, course, program and year", () => {
      expect(filter("all", "TP2")).toEqual([-1, 3]);
      expect(filter("all", "asr")).toEqual([-1, 4]);
      expect(filter("all", "m1")).toEqual([-1, 2, 4]);
      expect(filter("all", "2025")).toEqual([-1, 3]);
    });

    it("should apply the status, course, program and year filters", () => {
      expect(filter("all", "", { ...allStatuses, status: { ...allStatuses.status, prepared: false, default: false } })).toEqual([-1, 2]);
      expect(filter("all", "", { ...allStatuses, course: "GLA" })).toEqual([-1, 2, 3]);
      expect(filter("all", "", { ...allStatuses, program: "M1" })).toEqual([-1, 2, 4]);
      expect(filter("all", "", { ...allStatuses, year: "2026" })).toEqual([-1, 2, 4]);
    });
  });

  describe("countActiveFilters", () => {
    it("should count the status block once and each dropdown value", () => {
      expect(countActiveFilters(allStatuses)).toBe(0);
      expect(countActiveFilters({ ...allStatuses, course: "GLA" })).toBe(1);
      expect(countActiveFilters({ ...allStatuses, course: "GLA", program: "M1", year: "2026" })).toBe(3);
      expect(countActiveFilters({ ...allStatuses, status: { ...allStatuses.status, ongoing: false } })).toBe(1);
    });
  });

  describe("cleanHostname", () => {
    it("should strip the protocol, the www/gitlab prefixes and the trailing slash", () => {
      expect(cleanHostname("https://gitlab.example.com/")).toBe("example.com");
      expect(cleanHostname("http://www.example.com")).toBe("example.com");
      expect(cleanHostname("gitlab.com")).toBe("com");
      expect(cleanHostname("example.com")).toBe("example.com");
    });
  });

  describe("buildProviderFilterPills", () => {
    const build = (overrides: any = {}) =>
      buildProviderFilterPills({
        assignments,
        isGithubConnected: false,
        isGitlabConnected: false,
        customAccounts: [],
        hasAccountForHost: () => false,
        ...overrides,
      });

    it("should always start with « all » and end with « archived »", () => {
      const pills = build();
      expect(pills[0].key).toBe("all");
      expect(pills[pills.length - 1].key).toBe("archived");
    });

    it("should list one pill per provider used by an assignment", () => {
      expect(build().map((p) => p.key)).toEqual(["all", "github", "gitlab", "gitlab:gitlab.example.com", "archived"]);
    });

    it("should list a connected provider even without any assignment", () => {
      const pills = build({ assignments: [], isGithubConnected: true, isGitlabConnected: true });
      expect(pills.map((p) => p.key)).toEqual(["all", "github", "gitlab", "archived"]);
    });

    it("should name custom instances and flag them", () => {
      const pills = build();
      const custom = pills.filter((p) => p.isCustom);
      expect(custom.length).toBe(1);
      expect(custom[0].label).toBe("GitLab (example.com)");
    });

    it("should prefer the instance name declared on the account", () => {
      const pills = build({
        customAccounts: [{ instanceHost: "gitlab.example.com", instanceName: "GitLab IUT" }],
      });
      const custom = pills.filter((p) => p.isCustom);
      expect(custom[0].label).toBe("GitLab (GitLab IUT)");
      expect(custom[0].instanceName).toBe("GitLab IUT");
    });
  });
});
