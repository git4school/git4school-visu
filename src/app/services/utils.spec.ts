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
});
