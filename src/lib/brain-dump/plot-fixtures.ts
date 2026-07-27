import { expect } from "vitest";

import type { ProposedItem } from "./types";

export interface PlotPromptFixture {
  name: string;
  dump: string;
  minItems: number;
  assert?: (items: ProposedItem[]) => void;
}

/** Real-world plot prompts — add new cases here as users report misses. */
export const PLOT_PROMPT_FIXTURES: PlotPromptFixture[] = [
  // ── Follow-ups + call context ─────────────────────────────────────
  {
    name: "acme corp atlas follow-up after call",
    dump: "just finished call with acme corp, need to follow up with them by next friday for ATLAS",
    minItems: 1,
    assert: (i) => {
      expect(i[0].structure?.areaName).toBe("ATLAS");
      expect(i[0].type).toBe("follow-up");
      expect(i[0].contactName).toBe("Acme Corp");
    },
  },
  {
    name: "finished meeting context",
    dump: "finished meeting with acme corp, send proposal by monday for Work",
    minItems: 1,
    assert: (i) => expect(i[0].contactName).toBe("Acme Corp"),
  },
  {
    name: "talked to recruiter",
    dump: "talked to recruiter at stripe, follow up next week about internship",
    minItems: 1,
    assert: (i) => expect(i[0].type).toBe("follow-up"),
  },
  {
    name: "met with professor",
    dump: "met with professor kim, email about extension by thursday #work",
    minItems: 1,
  },
  {
    name: "wrapped up call",
    dump: "wrapped up call with mom, call her back sunday 5pm #personal",
    minItems: 1,
  },
  {
    name: "follow up google",
    dump: "follow up Google about internship next week !",
    minItems: 1,
    assert: (i) => {
      expect(i[0].type).toBe("follow-up");
      expect(i[0].priority).toBe(true);
    },
  },
  {
    name: "reach out client",
    dump: "need to reach out to client about contract renewal friday",
    minItems: 1,
  },
  {
    name: "bump recruiter",
    dump: "bump recruiter tomorrow 9am #work",
    minItems: 1,
  },
  {
    name: "waiting on reply",
    dump: "waiting on sarah for feedback, check in wednesday",
    minItems: 1,
  },
  {
    name: "email prof about extension",
    dump: "email prof about extension tomorrow",
    minItems: 1,
    assert: (i) => {
      expect(i[0].type).toBe("deadline");
      expect(i[0].dueAt).toBeTruthy();
    },
  },

  // ── Area creation & tagging ─────────────────────────────────────────
  {
    name: "for atlas uses existing area",
    dump: "follow up with Acme Corp for ATLAS",
    minItems: 1,
    assert: (i) => {
      expect(i[0].structure?.areaName).toBe("ATLAS");
      expect(i[0].structure?.createArea).toBe(false);
    },
  },
  {
    name: "for climb creates when missing",
    dump: "follow up with sponsor for PEAK",
    minItems: 1,
    assert: (i) => {
      expect(i[0].structure?.areaName).toBe("PEAK");
      expect(i[0].structure?.createArea).toBe(true);
    },
  },
  {
    name: "hash personal",
    dump: "call mom sunday 5pm #personal",
    minItems: 1,
    assert: (i) =>
      expect(i[0].structure?.areaName?.toLowerCase()).toBe("personal"),
  },
  {
    name: "hash work",
    dump: "submit report tomorrow 9am #work",
    minItems: 1,
    assert: (i) => expect(i[0].structure?.areaName?.toLowerCase()).toBe("work"),
  },
  {
    name: "new area with subgroups",
    dump: "new area Event Prep (Sponsors, Logistics) Outreach sponsors: book venue",
    minItems: 1,
    assert: (i) => {
      expect(i[0].structure?.createArea).toBe(true);
      expect(i[0].structure?.ensureSubgroups).toEqual(
        expect.arrayContaining(["Sponsors", "Logistics"]),
      );
    },
  },
  {
    name: "create area robotics",
    dump: "create area Robotics (Build, Outreach) Build: order parts tomorrow",
    minItems: 1,
    assert: (i) => {
      expect(i[0].structure?.areaName).toBe("Robotics");
      expect(i[0].structure?.childGroup).toBe("Build");
    },
  },
  {
    name: "in area tail",
    dump: "prep slides by friday in Work",
    minItems: 1,
    assert: (i) => expect(i[0].structure?.areaName?.toLowerCase()).toBe("work"),
  },
  {
    name: "under area tail",
    dump: "buy groceries tonight under Personal",
    minItems: 1,
  },
  {
    name: "leading caps area",
    dump: "ATLAS sponsors: follow up with Acme Corp by friday",
    minItems: 1,
    assert: (i) => expect(i[0].structure?.areaName).toBe("ATLAS"),
  },

  // ── Folders & subgroups ───────────────────────────────────────────
  {
    name: "work folder colon",
    dump: "Work Q3 Planning: finalize roadmap friday",
    minItems: 1,
    assert: (i) => expect(i[0].structure?.folderName).toMatch(/Q3 Planning/i),
  },
  {
    name: "path three segments",
    dump: "ATLAS > Outreach > Sponsors > email Google tomorrow",
    minItems: 1,
    assert: (i) => {
      expect(i[0].structure?.folderName).toBe("Outreach");
      expect(i[0].structure?.childGroup).toBe("Sponsors");
    },
  },
  {
    name: "path slash syntax",
    dump: "ATLAS / Fall Campaign / Events / book room friday",
    minItems: 1,
    assert: (i) => expect(i[0].structure?.childGroup).toBe("Events"),
  },
  {
    name: "for area under folder",
    dump: "for ATLAS under Fall Outreach - prep deck by wednesday",
    minItems: 1,
    assert: (i) => expect(i[0].structure?.folderName).toBe("Fall Outreach"),
  },
  {
    name: "under folder dash",
    dump: "under Client Acme - send invoice tomorrow #work",
    minItems: 1,
    assert: (i) => expect(i[0].structure?.folderName).toBe("Client Acme"),
  },
  {
    name: "area folder after personal",
    dump: "Personal Health: schedule dentist next month",
    minItems: 1,
    assert: (i) =>
      expect(i[0].structure?.areaName?.toLowerCase()).toBe("personal"),
  },
  {
    name: "context plus subgroup colon",
    dump: "finished call with Google, ATLAS sponsors: send thank you note tomorrow",
    minItems: 1,
    assert: (i) => {
      expect(i[0].contactName).toBe("Google");
      expect(i[0].structure?.childGroup).toBe("Sponsors");
    },
  },
  {
    name: "subgroup only colon",
    dump: "ATLAS events: reserve auditorium friday",
    minItems: 1,
    assert: (i) => expect(i[0].structure?.childGroup).toBe("Events"),
  },
  {
    name: "nested path four deep",
    dump: "Robotics > Spring Season > Build > calibrate sensors wednesday",
    minItems: 1,
    assert: (i) => {
      expect(i[0].structure?.folderName).toBe("Spring Season");
      expect(i[0].structure?.childGroup).toBe("Build");
    },
  },

  // ── Dates & priority ────────────────────────────────────────────────
  {
    name: "tomorrow morning",
    dump: "pay rent tomorrow 9am #personal",
    minItems: 1,
    assert: (i) => expect(i[0].dueAt).toBeTruthy(),
  },
  {
    name: "friday due",
    dump: "cs homework due friday #work",
    minItems: 1,
    assert: (i) => expect(i[0].dueAt).toBeTruthy(),
  },
  {
    name: "next friday",
    dump: "submit essay by next friday #work",
    minItems: 1,
    assert: (i) => expect(i[0].dueAt).toBeTruthy(),
  },
  {
    name: "next monday priority",
    dump: "ATLAS sponsors: submit budget ! by next monday",
    minItems: 1,
    assert: (i) => {
      expect(i[0].priority).toBe(true);
      expect(i[0].dueAt).toBeTruthy();
    },
  },
  {
    name: "tonight",
    dump: "pack bags tonight #personal",
    minItems: 1,
  },
  {
    name: "next week",
    dump: "prep presentation next week #work",
    minItems: 1,
  },
  {
    name: "weekday time",
    dump: "standup mon 9:30am #work",
    minItems: 1,
    assert: (i) => expect(i[0].dueAt).toBeTruthy(),
  },
  {
    name: "trailing bang priority",
    dump: "pay rent tomorrow ! #personal",
    minItems: 1,
    assert: (i) => expect(i[0].priority).toBe(true),
  },

  // ── Single-line multi-task (comma) ────────────────────────────────
  {
    name: "comma two tasks",
    dump: "pay rent tomorrow #personal, email prof friday #work",
    minItems: 2,
  },
  {
    name: "comma three tasks",
    dump: "email prof tomorrow, gym friday, pay rent !",
    minItems: 3,
  },
  {
    name: "comma with context not split wrong",
    dump: "finished call with acme corp, need to finish proposal by friday",
    minItems: 1,
  },

  // ── Multi-line lists ──────────────────────────────────────────────
  {
    name: "bullet list mixed",
    dump: `- email prof tomorrow #work
- gym friday #personal
- ATLAS sponsors: follow up acme`,
    minItems: 3,
  },
  {
    name: "numbered list",
    dump: `1. finish stats hw thursday
2. email ta about office hours
3. exam review sunday 2pm`,
    minItems: 2,
  },
  {
    name: "asterisk list",
    dump: `* buy milk tomorrow
* call mom sunday
* submit report friday #work`,
    minItems: 3,
  },
  {
    name: "multi atlas lines",
    dump: `- ATLAS sponsors: email Google
- ATLAS events: book room friday`,
    minItems: 2,
    assert: (i) =>
      expect(i.every((x) => x.structure?.areaName === "ATLAS")).toBe(true),
  },
  {
    name: "messy week dump",
    dump: `email prof about extension
cs homework due friday
follow up acme corp next week !
buy milk tomorrow`,
    minItems: 3,
  },
  {
    name: "work outreach week",
    dump: `need to follow up with Google about internship
send thank you note to recruiter tomorrow 9am
prep deck for monday meeting`,
    minItems: 2,
    assert: (i) => expect(i.some((x) => x.type === "follow-up")).toBe(true),
  },
  {
    name: "mixed personal week",
    dump: `gym mon wed fri
call mom sunday
pay rent tomorrow !`,
    minItems: 2,
  },

  // ── Task types ────────────────────────────────────────────────────
  {
    name: "routine gym",
    dump: "gym every morning #personal",
    minItems: 1,
    assert: (i) => expect(i[0].type).toBe("routine"),
  },
  {
    name: "note prefix",
    dump: "note: wifi password is on the fridge #personal",
    minItems: 1,
    assert: (i) => expect(i[0].type).toBe("note"),
  },
  {
    name: "deadline homework",
    dump: "finish problem set 6 by thursday #work",
    minItems: 1,
  },
  {
    name: "follow up type prefix",
    dump: "follow-up: jake owes slides #work",
    minItems: 1,
    assert: (i) => expect(i[0].type).toBe("follow-up"),
  },

  // ── School / work phrasing ────────────────────────────────────────
  {
    name: "stats homework",
    dump: "finish stats problem set by thursday #work",
    minItems: 1,
  },
  {
    name: "exam prep",
    dump: "exam review session sunday 2pm #work",
    minItems: 1,
  },
  {
    name: "ta email",
    dump: "email ta about office hours tomorrow",
    minItems: 1,
  },
  {
    name: "presentation prep",
    dump: "prep deck for monday meeting #work",
    minItems: 1,
  },
  {
    name: "interview follow up",
    dump: "send thank you after interview with meta tomorrow #work",
    minItems: 1,
  },

  // ── Personal errands ──────────────────────────────────────────────
  {
    name: "groceries",
    dump: "buy groceries tomorrow #personal",
    minItems: 1,
  },
  {
    name: "dentist",
    dump: "book dentist next month #personal",
    minItems: 1,
  },
  {
    name: "laundry",
    dump: "do laundry tonight #personal",
    minItems: 1,
  },
  {
    name: "call dad",
    dump: "call dad sunday evening #personal",
    minItems: 1,
  },
  {
    name: "gym schedule",
    dump: "gym mon wed fri #personal",
    minItems: 1,
  },

  // ── Complex / agentic combos ──────────────────────────────────────
  {
    name: "full agentic plot",
    dump: "new area ATLAS (sponsors, events) Fall Outreach sponsors: follow up with Acme Corp by next friday",
    minItems: 1,
    assert: (i) => {
      expect(i[0].structure?.createArea).toBe(true);
      expect(i[0].structure?.folderName).toBe("Fall Outreach");
      expect(i[0].structure?.childGroup).toBe("Sponsors");
    },
  },
  {
    name: "proposal after call atlas",
    dump: "finished call with acme corp, need to finish my proposal and send a follow up by friday for ATLAS",
    minItems: 1,
    assert: (i) => {
      expect(i[0].structure?.areaName).toBe("ATLAS");
      expect(i[0].contactName).toBe("Acme Corp");
    },
  },
  {
    name: "create area then path",
    dump: "create area PEAK (Sponsors, Finance) > Spring Gala > Sponsors > email venue",
    minItems: 1,
    assert: (i) => expect(i[0].structure?.createArea).toBe(true),
  },
  {
    name: "work project nested",
    dump: "Work > Client Acme > Legal: review contract by wednesday",
    minItems: 1,
    assert: (i) => expect(i[0].structure?.areaName?.toLowerCase()).toBe("work"),
  },
  {
    name: "personal health nested",
    dump: "Personal / Fitness / Gym / leg day friday 7am",
    minItems: 1,
  },
  {
    name: "multi area comma",
    dump: "ATLAS sponsors: email google, Work Q3 Planning: update roadmap friday",
    minItems: 2,
  },
  {
    name: "long context single task",
    dump: "just finished call with acme corp about sponsorship tier, need to follow up with them by next friday for ATLAS",
    minItems: 1,
    assert: (i) => expect(i[0].structure?.areaName).toBe("ATLAS"),
  },

  // ── More natural language variants ────────────────────────────────
  {
    name: "need to finish",
    dump: "need to finish my proposal by friday #work",
    minItems: 1,
  },
  {
    name: "remember to",
    dump: "remember to call pharmacy tomorrow #personal",
    minItems: 1,
  },
  {
    name: "dont forget",
    dump: "don't forget to pay utilities tomorrow #personal",
    minItems: 1,
  },
  {
    name: "gotta submit",
    dump: "gotta submit application by sunday #work",
    minItems: 1,
  },
  {
    name: "should prep",
    dump: "should prep for interview monday 10am #work",
    minItems: 1,
  },
  {
    name: "book flight",
    dump: "book flight to nyc next week #personal",
    minItems: 1,
  },
  {
    name: "schedule meeting",
    dump: "schedule meeting with team wednesday 3pm #work",
    minItems: 1,
  },
  {
    name: "write report",
    dump: "write quarterly report by end of month #work",
    minItems: 1,
  },
  {
    name: "read chapter",
    dump: "read chapter 5 before class tuesday #work",
    minItems: 1,
  },
  {
    name: "fix bug",
    dump: "fix login bug before release friday #work",
    minItems: 1,
  },
  {
    name: "return package",
    dump: "return amazon package by saturday #personal",
    minItems: 1,
  },
  {
    name: "apply internship",
    dump: "apply to summer internship by march 1 #work",
    minItems: 1,
  },
  {
    name: "study exam",
    dump: "study for midterm all weekend #work",
    minItems: 1,
  },
  {
    name: "pack for trip",
    dump: "pack for trip tomorrow night #personal",
    minItems: 1,
  },
  {
    name: "water plants",
    dump: "water plants tonight #personal",
    minItems: 1,
  },

  // ── Edge cases that should still parse ────────────────────────────
  {
    name: "single short task",
    dump: "buy milk tomorrow",
    minItems: 1,
  },
  {
    name: "single word verb date",
    dump: "gym friday",
    minItems: 1,
  },
  {
    name: "email only",
    dump: "email professor",
    minItems: 1,
    assert: (i) => expect(i[0].type).toBe("follow-up"),
  },
  {
    name: "pay rent",
    dump: "pay rent !",
    minItems: 1,
    assert: (i) => expect(i[0].priority).toBe(true),
  },
  {
    name: "parens in new area not split",
    dump: "new area My Club (Events, Finance) Events: plan social friday",
    minItems: 1,
    assert: (i) => expect(i[0].structure?.areaName).toBe("My Club"),
  },

  // ── More follow-ups & networking ──────────────────────────────────
  {
    name: "ping investor",
    dump: "ping investor about term sheet by tuesday #work",
    minItems: 1,
  },
  {
    name: "circle back teammate",
    dump: "circle back with alex about api design next week",
    minItems: 1,
  },
  {
    name: "touch base manager",
    dump: "touch base with manager about pto friday 2pm #work",
    minItems: 1,
  },
  {
    name: "send deck after demo",
    dump: "just finished demo with acme, send deck by tomorrow #work",
    minItems: 1,
    assert: (i) => expect(i[0].contactName).toBe("Acme"),
  },
  {
    name: "thank you after coffee chat",
    dump: "had coffee chat with jordan, send thank you note tomorrow",
    minItems: 1,
  },
  {
    name: "follow up linkedin connection",
    dump: "follow up linkedin connection about referral next monday",
    minItems: 1,
  },
  {
    name: "nudge designer",
    dump: "nudge designer for mockups by wednesday #work",
    minItems: 1,
  },
  {
    name: "waiting on legal",
    dump: "waiting on legal for redlines, ping thursday if no reply",
    minItems: 1,
    assert: (i) => expect(i[0].type).toBe("follow-up"),
  },
  {
    name: "check in with mentor",
    dump: "check in with mentor about grad school apps friday",
    minItems: 1,
  },
  {
    name: "reply to client thread",
    dump: "reply to client thread about pricing by eod #work",
    minItems: 1,
  },

  // ── School & academics ────────────────────────────────────────────
  {
    name: "office hours question",
    dump: "ask ta about problem 4 at office hours tomorrow",
    minItems: 1,
  },
  {
    name: "lab report",
    dump: "submit lab report 3 by sunday 11:59pm #work",
    minItems: 1,
  },
  {
    name: "group project sync",
    dump: "schedule group project sync tuesday 7pm #work",
    minItems: 1,
  },
  {
    name: "study group",
    dump: "study group for calc midterm saturday 1pm #work",
    minItems: 1,
  },
  {
    name: "register classes",
    dump: "register for spring classes monday 8am #work",
    minItems: 1,
  },
  {
    name: "thesis advisor",
    dump: "email thesis advisor draft by next wednesday #work",
    minItems: 1,
  },
  {
    name: "scholarship deadline",
    dump: "submit scholarship application by jan 15 ! #work",
    minItems: 1,
    assert: (i) => expect(i[0].priority).toBe(true),
  },
  {
    name: "quiz review",
    dump: "review lecture notes before quiz thursday #work",
    minItems: 1,
  },

  // ── Work & engineering ────────────────────────────────────────────
  {
    name: "deploy hotfix",
    dump: "deploy hotfix to prod tonight after standup #work",
    minItems: 1,
  },
  {
    name: "code review",
    dump: "review pr from sam by tomorrow morning #work",
    minItems: 1,
  },
  {
    name: "write postmortem",
    dump: "write postmortem for outage by friday #work",
    minItems: 1,
  },
  {
    name: "update jira",
    dump: "update jira tickets before sprint planning #work",
    minItems: 1,
  },
  {
    name: "oncall handoff",
    dump: "prep oncall handoff doc for monday #work",
    minItems: 1,
  },
  {
    name: "stakeholder update",
    dump: "send stakeholder update email friday 4pm #work",
    minItems: 1,
  },
  {
    name: "refactor module",
    dump: "refactor auth module before release next week #work",
    minItems: 1,
  },
  {
    name: "qa regression",
    dump: "run qa regression suite before deploy wednesday #work",
    minItems: 1,
  },

  // ── Personal life & errands ───────────────────────────────────────
  {
    name: "renew passport",
    dump: "renew passport appointment next month #personal",
    minItems: 1,
  },
  {
    name: "car oil change",
    dump: "schedule car oil change saturday morning #personal",
    minItems: 1,
  },
  {
    name: "pick up prescription",
    dump: "pick up prescription after class tomorrow #personal",
    minItems: 1,
  },
  {
    name: "vet appointment",
    dump: "take dog to vet tuesday 3pm #personal",
    minItems: 1,
  },
  {
    name: "birthday gift",
    dump: "buy birthday gift for mom before sunday #personal",
    minItems: 1,
  },
  {
    name: "tax documents",
    dump: "gather tax documents by end of february #personal",
    minItems: 1,
  },
  {
    name: "cancel subscription",
    dump: "cancel unused subscription before renewal friday #personal",
    minItems: 1,
  },
  {
    name: "meal prep",
    dump: "meal prep for the week sunday evening #personal",
    minItems: 1,
  },

  // ── Health & fitness ──────────────────────────────────────────────
  {
    name: "morning run",
    dump: "morning run every tuesday and thursday #personal",
    minItems: 1,
    assert: (i) => expect(i[0].type).toBe("routine"),
  },
  {
    name: "therapy session",
    dump: "therapy session wednesday 6pm #personal",
    minItems: 1,
  },
  {
    name: "stretch routine",
    dump: "stretch routine before bed tonight #personal",
    minItems: 1,
  },
  {
    name: "refill meds",
    dump: "refill meds before trip next week #personal",
    minItems: 1,
  },

  // ── Travel & events ───────────────────────────────────────────────
  {
    name: "check in flight",
    dump: "check in for flight tomorrow 6am #personal",
    minItems: 1,
  },
  {
    name: "pack carry on",
    dump: "pack carry on tonight for early flight #personal",
    minItems: 1,
  },
  {
    name: "airbnb checkout",
    dump: "airbnb checkout sunday 11am, strip beds #personal",
    minItems: 1,
  },
  {
    name: "conference badge",
    dump: "pick up conference badge thursday morning #work",
    minItems: 1,
  },
  {
    name: "rsvp wedding",
    dump: "rsvp to wedding by march 1 #personal",
    minItems: 1,
  },

  // ── Finance & admin ───────────────────────────────────────────────
  {
    name: "pay credit card",
    dump: "pay credit card bill by the 5th ! #personal",
    minItems: 1,
    assert: (i) => expect(i[0].priority).toBe(true),
  },
  {
    name: "submit expense report",
    dump: "submit expense report for client dinner friday #work",
    minItems: 1,
  },
  {
    name: "invoice client",
    dump: "send invoice to client acme by end of week #work",
    minItems: 1,
  },
  {
    name: "transfer rent",
    dump: "transfer rent to landlord tomorrow #personal",
    minItems: 1,
  },

  // ── Club / org agentic plots ──────────────────────────────────────
  {
    name: "atlas outreach path",
    dump: "ATLAS > Fall Outreach > Sponsors > draft sponsorship deck friday",
    minItems: 1,
    assert: (i) => expect(i[0].structure?.areaName).toBe("ATLAS"),
  },
  {
    name: "atlas events subgroup",
    dump: "ATLAS events: confirm catering for gala saturday",
    minItems: 1,
    assert: (i) => expect(i[0].structure?.childGroup).toBe("Events"),
  },
  {
    name: "new area with immediate task",
    dump: "new area Debate Club (Research, Outreach) Outreach: email schools by monday",
    minItems: 1,
    assert: (i) => expect(i[0].structure?.createArea).toBe(true),
  },
  {
    name: "for atlas under sponsors",
    dump: "email google sponsorship proposal for ATLAS under Fall Outreach - send by friday",
    minItems: 1,
    assert: (i) => expect(i[0].structure?.areaName).toBe("ATLAS"),
  },
  {
    name: "robotics build task",
    dump: "Robotics Build: calibrate arm motors wednesday",
    minItems: 1,
  },

  // ── Voice-dump / messy phrasing ───────────────────────────────────
  {
    name: "um need to",
    dump: "um need to finish essay and also email prof about extension",
    minItems: 1,
  },
  {
    name: "oh yeah rent",
    dump: "oh yeah pay rent tomorrow !",
    minItems: 1,
  },
  {
    name: "random brain dump",
    dump: "buy birthday card, call grandma sunday, submit timesheet friday",
    minItems: 2,
  },
  {
    name: "lowercase casual",
    dump: "gotta email sarah about the doc by thurs #work",
    minItems: 1,
  },
  {
    name: "no punctuation dump",
    dump: "gym tomorrow, dentist next week, pay utilities friday",
    minItems: 2,
  },
  {
    name: "remind me",
    dump: "remind me to water plants tonight #personal",
    minItems: 1,
  },
  {
    name: "asap urgent",
    dump: "fix production bug asap ! #work",
    minItems: 1,
    assert: (i) => expect(i[0].priority).toBe(true),
  },
  {
    name: "end of week",
    dump: "wrap up sprint tasks by end of week #work",
    minItems: 1,
  },
  {
    name: "this weekend",
    dump: "clean apartment this weekend #personal",
    minItems: 1,
  },
  {
    name: "eod today",
    dump: "send status update to team by eod today #work",
    minItems: 1,
  },

  // ── Type prefixes & notes ─────────────────────────────────────────
  {
    name: "project prefix",
    dump: "project: redesign onboarding flow #work",
    minItems: 1,
    assert: (i) => expect(i[0].type).toBe("project"),
  },
  {
    name: "deadline prefix",
    dump: "deadline: submit portfolio site by sunday #work",
    minItems: 1,
    assert: (i) => expect(i[0].type).toBe("deadline"),
  },
  {
    name: "routine prefix",
    dump: "routine: meditate 10 min every morning #personal",
    minItems: 1,
    assert: (i) => expect(i[0].type).toBe("routine"),
  },
  {
    name: "note meeting room",
    dump: "note: meeting room code is 4821 #work",
    minItems: 1,
    assert: (i) => expect(i[0].type).toBe("note"),
  },

  // ── Multi-task comma & newline stress ─────────────────────────────
  {
    name: "comma four tasks",
    dump: "email prof, gym friday, pay rent, call mom sunday",
    minItems: 3,
  },
  {
    name: "comma mixed areas",
    dump: "ATLAS sponsors: email venue, buy groceries tonight #personal",
    minItems: 2,
  },
  {
    name: "newline work dump",
    dump: `standup prep monday 9am
review design mocks tuesday
ship feature flag wednesday #work`,
    minItems: 2,
  },
  {
    name: "context comma chain",
    dump: "finished call with meta recruiter, follow up with them next week, update resume friday",
    minItems: 1,
  },
  {
    name: "semicolon separated",
    dump: "email prof tomorrow; gym friday; pay rent !",
    minItems: 1,
  },

  // ── Pronouns & contact resolution ─────────────────────────────────
  {
    name: "them pronoun acme corp",
    dump: "finished call with acme corp, follow up with them friday for ATLAS",
    minItems: 1,
    assert: (i) => expect(i[0].contactName).toBe("Acme Corp"),
  },
  {
    name: "her pronoun mom",
    dump: "talked to mom, call her sunday evening #personal",
    minItems: 1,
    assert: (i) => expect(i[0].contactName).toBe("Mom"),
  },
  {
    name: "bare follow up acme",
    dump: "follow up acme about contract tomorrow",
    minItems: 1,
    assert: (i) => expect(i[0].type).toBe("follow-up"),
  },

  // ── Time-specific phrasing ──────────────────────────────────────────
  {
    name: "noon deadline",
    dump: "submit form by tomorrow noon #work",
    minItems: 1,
    assert: (i) => expect(i[0].dueAt).toBeTruthy(),
  },
  {
    name: "evening call",
    dump: "call insurance company tomorrow evening #personal",
    minItems: 1,
  },
  {
    name: "early morning flight",
    dump: "leave for airport monday 5:30am #personal",
    minItems: 1,
  },
  {
    name: "next tuesday",
    dump: "dentist appointment next tuesday 2pm #personal",
    minItems: 1,
  },

  // ── Should-not-split context cases ────────────────────────────────
  {
    name: "finished call no false split",
    dump: "just finished call with acme corp about tiers, send revised proposal friday",
    minItems: 1,
  },
  {
    name: "waiting not area",
    dump: "waiting on sarah for feedback by wednesday",
    minItems: 1,
    assert: (i) => expect(i[0].type).toBe("follow-up"),
  },
  {
    name: "check in date not area",
    dump: "check in wednesday for hotel confirmation #personal",
    minItems: 1,
  },
];
