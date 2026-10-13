import { TestBed } from "@angular/core/testing";
import { Commit } from "@models/Commit.model";
import { Repository } from "@models/Repository.model";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { AnonymizationService } from "@services/anonymization.service";
import { DataService } from "@services/data.service";

describe("AnonymizationService", () => {
  let service: AnonymizationService;
  let dataService: DataService;
  let translateService: TranslateService;

  const mockRepositories = [
    new Repository("https://github.com/org/tp-alice", "Alice Dupont"),
    new Repository("https://github.com/org/tp-bob", "Bob Martin"),
    new Repository("https://github.com/org/tp-charlie", "Charlie Durand"),
  ];

  beforeEach(() => {
    localStorage.removeItem("git4school_anonymous_mode");
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        AnonymizationService,
        {
          provide: DataService,
          useValue: {
            repositories: mockRepositories,
          },
        },
      ],
    });

    service = TestBed.inject(AnonymizationService);
    dataService = TestBed.inject(DataService);
    translateService = TestBed.inject(TranslateService);

    translateService.setTranslation("fr", {
      ANONYMOUS: {
        STUDENT_LABEL: "Étudiant·e {{index}}",
        STUDENT_PREFIX: "Étudiant·e",
        STUDENT_FALLBACK: "Étudiant·e",
        ANONYMOUS_AUTHOR: "Auteur masqué",
        ACTIVE_BADGE: "Anonymat actif",
      },
    });
    translateService.use("fr");
  });

  afterEach(() => {
    localStorage.removeItem("git4school_anonymous_mode");
  });

  it("should be created with anonymous mode disabled by default", () => {
    expect(service).toBeTruthy();
    expect(service.isAnonymous).toBeFalse();
  });

  it("should toggle anonymous mode and notify subscribers", (done) => {
    service.toggleAnonymousMode();
    expect(service.isAnonymous).toBeTrue();

    service.isAnonymous$.subscribe((isAnon) => {
      expect(isAnon).toBeTrue();
      done();
    });
  });

  it("should return real name when anonymous mode is disabled", () => {
    service.setAnonymousMode(false);
    const repo = mockRepositories[0];
    expect(service.getDisplayName(repo)).toBe("Alice Dupont");
  });

  it("should return stable pseudonym when anonymous mode is enabled", () => {
    service.setAnonymousMode(true);
    expect(service.getDisplayName(mockRepositories[0])).toBe("Étudiant·e 1");
    expect(service.getDisplayName(mockRepositories[1])).toBe("Étudiant·e 2");
    expect(service.getDisplayName(mockRepositories[2])).toBe("Étudiant·e 3");
  });

  it("should anonymize commit author appropriately", () => {
    const commit = new Commit("feat: solution", "Alice Dupont", new Date(), "https://github.com/org/tp-alice/commit/123");
    mockRepositories[0].commits = [commit];

    service.setAnonymousMode(false);
    expect(service.getCommitAuthorDisplayName(commit, mockRepositories[0])).toBe("Alice Dupont");

    service.setAnonymousMode(true);
    expect(service.getCommitAuthorDisplayName(commit, mockRepositories[0])).toBe("Étudiant·e 1");
  });
});
