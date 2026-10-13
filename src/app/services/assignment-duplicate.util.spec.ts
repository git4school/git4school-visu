import { Assignment } from "@models/Assignment.model";
import { buildDuplicateAssignment, buildDuplicateTitle } from "./assignment-duplicate.util";

describe("assignment-duplicate.util", () => {
  describe("buildDuplicateTitle", () => {
    it("should append (1) to a title that has never been copied", () => {
      expect(buildDuplicateTitle("TP expé", ["TP expé"])).toBe("TP expé (1)");
    });

    it("should increment the copy index when a copy already exists", () => {
      expect(buildDuplicateTitle("TP expé", ["TP expé", "TP expé (1)"])).toBe("TP expé (2)");
    });

    it("should not reuse an index when copies are not contiguous", () => {
      expect(buildDuplicateTitle("TP expé", ["TP expé", "TP expé (1)", "TP expé (3)"])).toBe("TP expé (4)");
    });

    it("should strip the suffix of a copy belonging to a copy family", () => {
      expect(buildDuplicateTitle("TP (1)", ["TP", "TP (1)"])).toBe("TP (2)");
    });

    it("should keep a year-like suffix when the title is not part of a copy family", () => {
      expect(buildDuplicateTitle("TP (2026)", ["TP (2026)"])).toBe("TP (2026) (1)");
    });

    it("should ignore case and surrounding spaces when matching copies", () => {
      expect(buildDuplicateTitle("tp expé", ["TP EXPÉ", "tp expé (1)"])).toBe("tp expé (2)");
    });

    it("should ignore a stray space before the copy suffix", () => {
      expect(buildDuplicateTitle("TP", ["TP", "TP (1)", "TP(2)"])).toBe("TP (3)");
    });

    it("should return an empty title unchanged", () => {
      expect(buildDuplicateTitle("", ["TP"])).toBe("");
    });
  });

  describe("buildDuplicateAssignment", () => {
    it("should copy the pedagogical fields and the forge configuration", () => {
      const source = new Assignment();
      source.title = "TP expé";
      source.provider = "gitlab";
      source.instanceHost = "gitlab.univ-tlse3.fr";
      source.instanceName = "UT3";
      source.course = "Algorithmique";
      source.program = "Licence Informatique";
      source.year = "2025-2026";
      source.questions = ["Q1", "Q2"];
      source.closingMode = "custom";
      source.customClosingKeywords = ["FIN"];
      source.defaultSessionDuration = { hour: 2, minute: 15, second: 0 };
      source.startDate = "2025-09-01 08:00";
      source.endDate = "2025-12-19 18:00";
      source.sessions = [];
      source.repositories = [];
      source.archivedAt = new Date();

      const copy = buildDuplicateAssignment(source, ["TP expé"]);

      expect(copy.title).toBe("TP expé (1)");
      expect(copy.provider).toBe("gitlab");
      expect(copy.instanceHost).toBe("gitlab.univ-tlse3.fr");
      expect(copy.instanceName).toBe("UT3");
      expect(copy.course).toBe("Algorithmique");
      expect(copy.program).toBe("Licence Informatique");
      expect(copy.questions).toEqual(["Q1", "Q2"]);
      expect(copy.closingMode).toBe("custom");
      expect(copy.customClosingKeywords).toEqual(["FIN"]);
      expect(copy.defaultSessionDuration).toEqual({ hour: 2, minute: 15, second: 0 });
    });

    it("should leave out repositories, year, dates, milestones, sessions and archiving", () => {
      const source = new Assignment();
      source.title = "TP expé";
      source.year = "2025-2026";
      source.startDate = "2025-09-01 08:00";
      source.endDate = "2025-12-19 18:00";
      source.repositories = [];
      source.archivedAt = new Date();

      const copy = buildDuplicateAssignment(source, ["TP expé"]);

      expect(copy.year).toBeUndefined();
      expect(copy.startDate).toBeUndefined();
      expect(copy.endDate).toBeUndefined();
      expect(copy.repositories).toEqual([]);
      expect(copy.sessions).toEqual([]);
      expect(copy.reviews).toEqual([]);
      expect(copy.corrections).toEqual([]);
      expect(copy.others).toEqual([]);
      expect(copy.archivedAt).toBeUndefined();
    });

    it("should give the copy its own metadata instance", () => {
      const source = new Assignment();
      source.title = "TP expé";

      const copy = buildDuplicateAssignment(source, ["TP expé"]);
      copy.questions.push("Q3");

      expect(source.questions).toEqual([]);
    });
  });
});
