import { describe, expect, it } from "vitest";

import type { Category } from "../../types";

import { parseDumpWithRules } from "./rules-parser";

const categories: Category[] = [
  {
    id: "work",
    name: "Work",
    color: "#3b82f6",
    icon: "briefcase",
    sortOrder: 0,
    subgroups: ["Homework", "Exam"],
  },
  {
    id: "personal",
    name: "Personal",
    color: "#22c55e",
    icon: "home",
    sortOrder: 1,
  },
  {
    id: "smubia",
    name: "Smubia",
    color: "#a855f7",
    icon: "folder",
    sortOrder: 2,
  },
];

const NOW = new Date(2026, 6, 26, 10, 0, 0);

interface Scenario {
  name: string;
  dump: string;
  actions?: number;
  items?: number;
  actionTitles?: string[];
  actionKinds?: string[];
  itemTitles?: RegExp[];
  itemTypes?: string[];
  parentFolders?: string[];
  categoryIds?: string[];
  noReminderAboutFolder?: boolean;
}

const SCENARIOS: Scenario[] = [
  {
    name: "create folder for smubia",
    dump: "create a folder for smubia",
    actions: 1,
    items: 0,
    actionTitles: ["Smubia"],
    actionKinds: ["create_folder"],
    noReminderAboutFolder: true,
  },
  {
    name: "folder in workspace phrasing",
    dump: "create folder in the smubia workspace",
    actions: 1,
    items: 0,
    actionTitles: ["Smubia"],
  },
  {
    name: "new folder shorthand",
    dump: "new folder: Taxes",
    actions: 1,
    actionTitles: ["Taxes"],
  },
  {
    name: "create area",
    dump: "create an area called Side Projects",
    actions: 1,
    actionKinds: ["create_area"],
    actionTitles: ["Side Projects"],
  },
  {
    name: "folder for area in work",
    dump: "create a folder for Q3 Goals in Work",
    actions: 1,
    actionTitles: ["Q3 Goals"],
  },
  {
    name: "compound folder and task",
    dump: "create a folder for smubia and add visa checklist",
    actions: 1,
    items: 1,
    actionTitles: ["Smubia"],
    itemTitles: [/visa/i],
    parentFolders: ["Smubia"],
  },
  {
    name: "folder colon task",
    dump: "Smubia: review visa checklist",
    items: 1,
    itemTitles: [/visa/i],
    parentFolders: ["Smubia"],
  },
  {
    name: "subgroup folder syntax",
    dump: "CS101 Homework: problem set 3 due friday",
    items: 1,
    itemTitles: [/problem set/i],
    parentFolders: ["CS101 Homework"],
  },
  {
    name: "semicolon separated",
    dump: "email prof tomorrow; gym friday; pay rent !",
    items: 3,
  },
  {
    name: "comma separated",
    dump: "email prof tomorrow, gym friday, pay rent !",
    items: 3,
  },
  {
    name: "follow up with contact",
    dump: "follow up with Google about internship next week !",
    items: 1,
    itemTypes: ["follow-up"],
  },
  {
    name: "remind me filler",
    dump: "remind me to call mom sunday",
    items: 1,
    itemTitles: [/mom/i],
  },
  {
    name: "note prefix",
    dump: "note: meeting takeaways from standup",
    items: 1,
    itemTypes: ["note"],
  },
  {
    name: "jot down note",
    dump: "jot down: visa document list",
    items: 1,
    itemTypes: ["note"],
  },
  {
    name: "area hash tag",
    dump: "buy groceries tomorrow #personal",
    items: 1,
    categoryIds: ["personal"],
  },
  {
    name: "area in suffix",
    dump: "submit quarterly report friday in Work",
    items: 1,
    categoryIds: ["work"],
  },
  {
    name: "routine gym",
    dump: "gym mon wed fri",
    items: 1,
    itemTypes: ["routine"],
  },
  {
    name: "priority bang",
    dump: "pay rent tomorrow !",
    items: 1,
  },
  {
    name: "mixed feature and tasks multiline",
    dump: `create folder smubia
email landlord tomorrow
visa appointment friday`,
    actions: 1,
    items: 2,
  },
  {
    name: "set up folder",
    dump: "set up a folder for Immigration",
    actions: 1,
    actionTitles: ["Immigration"],
  },
  {
    name: "create workspace",
    dump: "create workspace Research",
    actions: 1,
    actionKinds: ["create_area"],
    actionTitles: ["Research"],
  },
  {
    name: "does not fake folder reminder",
    dump: "please create a folder for smubia",
    actions: 1,
    items: 0,
    noReminderAboutFolder: true,
  },
  {
    name: "context merge follow up",
    dump:
      "finished call with shopee, need to finish my proposal and send a follow up by friday.",
    items: 1,
    itemTypes: ["follow-up"],
  },
  {
    name: "bullet list",
    dump: `- finish stats homework by thursday
- email ta about office hours
- exam review sunday 2pm`,
    items: 3,
  },
  {
    name: "folder task with due date",
    dump: "Smubia: submit visa form by friday",
    items: 1,
    parentFolders: ["Smubia"],
  },
  {
    name: "tomorrow shorthand tmrw",
    dump: "dentist tmrw 9am",
    items: 1,
  },
  {
    name: "due by weekday",
    dump: "turn in lab report due thursday",
    items: 1,
  },
  {
    name: "thread bump",
    dump: "bump acme about contract",
    items: 1,
    itemTypes: ["follow-up"],
  },
  {
    name: "write down note",
    dump: "write down: packing list for trip",
    items: 1,
    itemTypes: ["note"],
  },
  {
    name: "task type prefix",
    dump: "task: renew passport by next month",
    items: 1,
  },
  {
    name: "follow-up prefix",
    dump: "follow-up: stripe onboarding",
    items: 1,
    itemTypes: ["follow-up"],
  },
  {
    name: "routine prefix",
    dump: "routine: stretch every morning",
    items: 1,
    itemTypes: ["routine"],
  },
  {
    name: "two folders two actions",
    dump: "create folder Taxes; create folder Travel",
    actions: 2,
    items: 0,
  },
  {
    name: "folder then task next line",
    dump: "create folder Immigration\nmedical exam appointment friday",
    actions: 1,
    items: 1,
    parentFolders: ["Immigration"],
  },
  {
    name: "personal area suffix workspace",
    dump: "book haircut saturday in personal workspace",
    items: 1,
    categoryIds: ["personal"],
  },
  {
    name: "no parse for bare folder word",
    dump: "folder",
    items: 0,
    actions: 0,
  },
  {
    name: "deck prep deadline",
    dump: "prep investor deck for monday meeting",
    items: 1,
    categoryIds: ["work"],
  },
  {
    name: "waiting on contact",
    dump: "waiting on sarah for feedback by wednesday",
    items: 1,
    itemTypes: ["follow-up"],
  },
  {
    name: "check in follow up",
    dump: "check in with mentor next tuesday",
    items: 1,
    itemTypes: ["follow-up"],
  },
  {
    name: "organize folder",
    dump: "organize a new folder for Receipts",
    actions: 1,
    actionTitles: ["Receipts"],
  },
  {
    name: "smubia area folder in smubia category",
    dump: "create folder for Visa in Smubia",
    actions: 1,
    actionTitles: ["Visa"],
  },
  {
    name: "task and task split",
    dump: "call mom and buy milk tomorrow",
    items: 2,
    itemTitles: [/mom/i, /milk/i],
  },
  {
    name: "relative in days",
    dump: "in 3 days renew passport",
    items: 1,
    itemTitles: [/passport/i],
  },
  {
    name: "FU shorthand",
    dump: "FU: google recruiter",
    items: 1,
    itemTypes: ["follow-up"],
  },
  {
    name: "every monday routine",
    dump: "every monday team sync",
    items: 1,
    itemTypes: ["routine"],
  },
  {
    name: "put task in named folder",
    dump: "put visa checklist in smubia folder",
    items: 1,
    parentFolders: ["smubia"],
  },
  {
    name: "urgent keyword priority",
    dump: "urgent fix production bug",
    items: 1,
  },
  {
    name: "pipe separated list",
    dump: "email prof | gym friday | pay rent",
    items: 3,
  },
  {
    name: "eod deadline",
    dump: "eod send team update",
    items: 1,
  },
  {
    name: "todo prefix",
    dump: "todo: pack for trip",
    items: 1,
  },
  {
    name: "next monday date",
    dump: "next monday standup prep",
    items: 1,
  },
  {
    name: "this friday date",
    dump: "this friday submit report",
    items: 1,
  },
  {
    name: "add area shorthand",
    dump: "add area Freelance",
    actions: 1,
    actionKinds: ["create_area"],
    actionTitles: ["Freelance"],
  },
];

describe("Plot scenario matrix", () => {
  for (const scenario of SCENARIOS) {
    it(scenario.name, () => {
      const { items, actions } = parseDumpWithRules(
        scenario.dump,
        categories,
        NOW,
      );

      if (scenario.actions !== undefined) {
        expect(actions).toHaveLength(scenario.actions);
      }
      if (scenario.items !== undefined) {
        expect(items).toHaveLength(scenario.items);
      }
      if (scenario.actionTitles) {
        expect(actions.map((a) => a.title)).toEqual(
          expect.arrayContaining(scenario.actionTitles),
        );
      }
      if (scenario.actionKinds) {
        expect(actions.map((a) => a.kind)).toEqual(
          expect.arrayContaining(scenario.actionKinds),
        );
      }
      if (scenario.itemTitles) {
        for (const re of scenario.itemTitles) {
          expect(items.some((i) => re.test(i.title))).toBe(true);
        }
      }
      if (scenario.itemTypes) {
        expect(items.map((i) => i.type)).toEqual(
          expect.arrayContaining(scenario.itemTypes),
        );
      }
      if (scenario.parentFolders) {
        expect(items.map((i) => i.parentFolderName)).toEqual(
          expect.arrayContaining(scenario.parentFolders),
        );
      }
      if (scenario.categoryIds) {
        for (const id of scenario.categoryIds) {
          expect(items.some((i) => i.categoryId === id)).toBe(true);
        }
      }
      if (scenario.noReminderAboutFolder) {
        expect(
          items.some((i) => /create.*folder/i.test(i.title)),
        ).toBe(false);
      }
    });
  }
});
