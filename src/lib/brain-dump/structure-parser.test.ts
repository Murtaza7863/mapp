import { describe, expect, it } from "vitest";

import type { Category } from "../../types";

import { parsePlotStructure } from "./structure-parser";

const baseCategories: Category[] = [
  {
    id: "work",
    name: "Work",
    color: "#3b82f6",
    icon: "briefcase",
    sortOrder: 0,
  },
  {
    id: "personal",
    name: "Personal",
    color: "#22c55e",
    icon: "home",
    sortOrder: 1,
  },
];

describe("parsePlotStructure", () => {
  it("parses explicit new area with subgroups and folder colon syntax", () => {
    const s = parsePlotStructure(
      "new area ATLAS (sponsors, events) Fall Outreach sponsors: email Acme Corp by friday",
      baseCategories,
    );
    expect(s.areaName).toBe("ATLAS");
    expect(s.createArea).toBe(true);
    expect(s.ensureSubgroups).toEqual(
      expect.arrayContaining(["Sponsors", "Events"]),
    );
    expect(s.folderName).toBe("Fall Outreach");
    expect(s.childGroup).toBe("Sponsors");
    expect(s.taskText).toMatch(/email Acme Corp/i);
  });

  it("parses for-area tail on follow-up", () => {
    const cats = [
      ...baseCategories,
      {
        id: "atlas",
        name: "ATLAS",
        color: "#f59e0b",
        icon: "star",
        sortOrder: 2,
        subgroups: ["Sponsors"],
      },
    ];
    const s = parsePlotStructure(
      "follow up with Acme Corp by next friday for ATLAS",
      cats,
    );
    expect(s.areaName).toBe("ATLAS");
    expect(s.createArea).toBe(false);
    expect(s.taskText).toMatch(/follow up with Acme Corp/i);
  });

  it("creates area when for-tail names unknown area", () => {
    const s = parsePlotStructure(
      "follow up with Acme Corp for ATLAS",
      baseCategories,
    );
    expect(s.areaName).toBe("ATLAS");
    expect(s.createArea).toBe(true);
  });

  it("parses path syntax area > folder > subgroup > task", () => {
    const s = parsePlotStructure(
      "ATLAS > Fall Outreach > Sponsors > follow up with Acme Corp",
      baseCategories,
    );
    expect(s.areaName).toBe("ATLAS");
    expect(s.createArea).toBe(true);
    expect(s.folderName).toBe("Fall Outreach");
    expect(s.childGroup).toBe("Sponsors");
    expect(s.taskText).toBe("follow up with Acme Corp");
  });

  it("parses simple folder colon syntax", () => {
    const s = parsePlotStructure(
      "Work Q3 Planning: finalize roadmap friday",
      baseCategories,
    );
    expect(s.areaName).toBe("Work");
    expect(s.folderName).toBe("Q3 Planning");
    expect(s.taskText).toMatch(/finalize roadmap/i);
  });

  it("parses hash area tag", () => {
    const s = parsePlotStructure(
      "email prof tomorrow #personal",
      baseCategories,
    );
    expect(s.areaName).toBe("Personal");
    expect(s.taskText).toMatch(/email prof/i);
  });

  it("parses under-folder dash syntax", () => {
    const s = parsePlotStructure(
      "under Fall Outreach - follow up with sponsor by monday",
      baseCategories,
    );
    expect(s.folderName).toBe("Fall Outreach");
    expect(s.taskText).toMatch(/follow up/i);
  });
});
