import { TestBed } from "@angular/core/testing";
import { DatabaseService } from "./database.service";
import { JsonManagerService } from "./json-manager.service";
import { Assignment } from "@models/Assignment.model";
import { Repository } from "@models/Repository.model";

describe("DatabaseService", () => {
  let service: DatabaseService;
  let jsonManagerSpy: jasmine.SpyObj<JsonManagerService>;

  beforeEach(() => {
    jsonManagerSpy = jasmine.createSpyObj("JsonManagerService", ["readFile", "saveJsonFile"]);

    TestBed.configureTestingModule({
      providers: [DatabaseService, { provide: JsonManagerService, useValue: jsonManagerSpy }],
    });
    service = TestBed.inject(DatabaseService);
  });

  afterEach(async () => {
    try {
      await service.assignments.clear();
    } catch {
      // ignore
    }
  });

  it("should be created and define version 5", () => {
    expect(service).toBeTruthy();
    expect(service.verno).toBe(5);
  });

  it("should automatically hydrate provider and instanceHost on legacy assignments in getAllAssignments", async () => {
    const legacyRaw: any = {
      id: 101,
      metadata: { title: "Legacy Assignment" },
      sessions: [],
      repositories: [{ url: "https://gitlab.univ-tlse3.fr/turing/tp1.git", name: "tp1" }],
    };

    await service.assignments.put(legacyRaw);

    const assignments = await service.getAllAssignments();
    const loaded = assignments.find((a) => a.id === 101);

    expect(loaded).toBeTruthy();
    expect(loaded?.provider).toBe("github");
    expect(loaded?.instanceHost).toBe("github.com");
  });

  it("should automatically resolve gitlab instance host when provider is gitlab in getAllAssignments", async () => {
    const gitlabLegacyRaw: any = {
      id: 102,
      metadata: { title: "GitLab Legacy Assignment" },
      provider: "gitlab",
      sessions: [],
      repositories: [{ url: "https://gitlab.univ-tlse3.fr/turing/tp2.git", name: "tp2" }],
    };

    await service.assignments.put(gitlabLegacyRaw);

    const assignments = await service.getAllAssignments();
    const loaded = assignments.find((a) => a.id === 102);

    expect(loaded).toBeTruthy();
    expect(loaded?.provider).toBe("gitlab");
    expect(loaded?.instanceHost).toBe("gitlab.univ-tlse3.fr");
  });

  it("should resolve SSH git repository hostname for gitlab assignment", async () => {
    const gitlabSshRaw: any = {
      id: 103,
      metadata: { title: "GitLab SSH Assignment" },
      provider: "gitlab",
      sessions: [],
      repositories: [{ url: "git@gitlab.irit.fr:group/project.git", name: "project" }],
    };

    await service.assignments.put(gitlabSshRaw);

    const assignments = await service.getAllAssignments();
    const loaded = assignments.find((a) => a.id === 103);

    expect(loaded).toBeTruthy();
    expect(loaded?.provider).toBe("gitlab");
    expect(loaded?.instanceHost).toBe("gitlab.irit.fr");
  });

  it("should populate instanceHost and provider when saving assignment", async () => {
    const assignment = new Assignment();
    assignment.title = "New Saved Assignment";
    assignment.provider = "gitlab";
    assignment.repositories = [new Repository("https://gitlab.example.org/user/repo", "repo")];

    const id = await service.saveAssignment(assignment);
    const rawStored = await service.assignments.get(id);

    expect(rawStored?.provider).toBe("gitlab");
    expect(rawStored?.instanceHost).toBe("gitlab.example.org");
  });
});
