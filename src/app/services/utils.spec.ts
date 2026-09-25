import { Utils } from "@services/utils";

describe("Utils", () => {
  describe("COMMIT_DATE_FORMAT", () => {
    it("should format date correctly with 1-based month", () => {
      // Month 0 is January -> should output '01'
      const janDate = new Date(2026, 0, 15, 14, 5, 9);
      expect(Utils.COMMIT_DATE_FORMAT(janDate)).toBe("15/01/2026 14:05:09");

      // Month 4 is May -> should output '05'
      const mayDate = new Date(2026, 4, 21, 23, 28, 27);
      expect(Utils.COMMIT_DATE_FORMAT(mayDate)).toBe("21/05/2026 23:28:27");

      // Month 11 is December -> should output '12'
      const decDate = new Date(2026, 11, 31, 23, 59, 59);
      expect(Utils.COMMIT_DATE_FORMAT(decDate)).toBe("31/12/2026 23:59:59");
    });

    it("should handle null or undefined gracefully", () => {
      expect(Utils.COMMIT_DATE_FORMAT(null as any)).toBe("");
      expect(Utils.COMMIT_DATE_FORMAT(undefined as any)).toBe("");
    });
  });

  describe("Multilingual Name and TP Group Extraction", () => {
    describe("getNameFromIdentity", () => {
      it("should extract name from identity json object", () => {
        const identity = { last_name: "DUPONT", first_name: "Alice", group: "G1" };
        expect(Utils.getNameFromIdentity(identity)).toBe("DUPONT Alice");
      });

      it("should handle missing first or last name in identity", () => {
        expect(Utils.getNameFromIdentity({ last_name: "DUPONT" })).toBe("DUPONT");
        expect(Utils.getNameFromIdentity({ first_name: "Alice" })).toBe("Alice");
        expect(Utils.getNameFromIdentity(null)).toBe("");
      });
    });

    describe("getNameFromReadMe", () => {
      it("should extract French tokens (Nom, Prénom)", () => {
        const readme = "# Projet\n**Nom** : DUPONT\n**Prénom** : Alice\n";
        expect(Utils.getNameFromReadMe(readme)).toBe("DUPONT Alice");
      });

      it("should extract French tokens without accents or in uppercase (NOM, PRENOM)", () => {
        const readme = "NOM : MARTIN\nPRENOM : Bob\n";
        expect(Utils.getNameFromReadMe(readme)).toBe("MARTIN Bob");
      });

      it("should extract English tokens (Last name, First name)", () => {
        const readme = "# Assignment\n* Last name: Smith\n* First name: John\n";
        expect(Utils.getNameFromReadMe(readme)).toBe("Smith John");
      });

      it("should extract English tokens variations (Surname, Given name, Lastname, Firstname)", () => {
        const readme = "Surname: Doe\nGiven name: Jane\n";
        expect(Utils.getNameFromReadMe(readme)).toBe("Doe Jane");
      });

      it("should extract Russian tokens (Фамилия, Имя)", () => {
        const readme = "Фамилия: Иванов\nИмя: Иван\n";
        expect(Utils.getNameFromReadMe(readme)).toBe("Иванов Иван");
      });

      it("should handle markdown formatting around tokens and values", () => {
        const readme = "### Identification\n- **Nom :** **Durand**\n- **Prénom :** **Claire**\n";
        expect(Utils.getNameFromReadMe(readme)).toBe("Durand Claire");
      });

      it("should return null if no tokens match", () => {
        const readme = "# Just a title\nSome random description without student identifiers.\n";
        expect(Utils.getNameFromReadMe(readme)).toBeNull();
      });

      it("should not capture next line markdown header when tokens are unfilled", () => {
        const readme =
          "# Identification du projet\n\nNOM :\n\nPrénom :\n\nGroupe de TP :\n(Éditez ce README.md et remplacez [ ] par [x])\n";
        expect(Utils.getNameFromReadMe(readme)).toBeNull();
      });
    });

    describe("extractRepositoryMetadata", () => {
      it("should prioritize IDENTITY.json over README.md", () => {
        const identityStr = JSON.stringify({ last_name: "FROM_IDENTITY", first_name: "ID_USER", group: "TP2" });
        const readmeStr = "Nom: FROM_README\nPrénom: RD_USER\n";
        const res = Utils.extractRepositoryMetadata(identityStr, readmeStr);
        expect(res.name).toBe("FROM_IDENTITY ID_USER");
        expect(res.tpGroup).toBe("TP2");
      });

      it("should fall back to multilingual README if IDENTITY.json is absent or invalid", () => {
        const invalidIdentityStr = "NOT_A_JSON";
        const readmeStr = "Last name: Williams\nFirst name: Sarah\n- [B]";
        const res = Utils.extractRepositoryMetadata(invalidIdentityStr, readmeStr);
        expect(res.name).toBe("Williams Sarah");
        expect(res.tpGroup).toBe("B");
      });

      it("should return empty strings if neither IDENTITY nor README provide name or group", () => {
        const res = Utils.extractRepositoryMetadata(null, "Nothing here");
        expect(res.name).toBe("");
        expect(res.tpGroup).toBe("");
      });
    });
  });
});
