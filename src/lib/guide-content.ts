export interface GuideSection {
  title: string;
  body: string[];
  examples?: string[];
}

export const GUIDE_INTRO =
  "Plot is the bar on Home. Type what you want — new tasks or commands that change what’s already there — then confirm before anything saves.";

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: "Add tasks in plain English",
    body: [
      "Say the task the way you’d say it out loud. Add a day when timing matters, #area for Work or Personal, and ! for priority.",
    ],
    examples: [
      "email prof tomorrow #work",
      "dentist tuesday #personal",
      "pay rent friday !",
      "gym mon wed fri",
    ],
  },
  {
    title: "Control what’s already there",
    body: [
      "Name the existing task in the same line. Plot matches it, shows a preview, and waits for you to apply.",
      "If two titles look alike, pick the right one in the confirm sheet.",
    ],
    examples: [
      "done: pay rent",
      "mark gym done",
      "snooze call mom until friday",
      "delete dentist",
      "reopen essay",
      "star gym",
      "reschedule rent to monday",
      "move essay to #personal",
      "file visa in Travel folder",
      "rename essay to final draft",
    ],
  },
  {
    title: "Jump around the app",
    body: ["Open screens, search, or filter an area without leaving Plot."],
    examples: [
      "open calendar",
      "show nudges",
      "find rent",
      "open folder Travel",
      "show area Work",
      "wrap up",
    ],
  },
  {
    title: "Day cleanup & settings",
    body: [
      "Batch actions and settings work the same way — preview, then apply.",
    ],
    examples: [
      "park open tasks",
      "bump all nudges",
      "complete all overdue",
      "turn on digest",
      "export backup",
      "create folder for Travel",
    ],
  },
  {
    title: "Always check the sheet",
    body: [
      "The confirm sheet is the safety net. Fix titles, dates, or which tasks are selected before you tap Add or Apply.",
    ],
  },
  {
    title: "Dates that work",
    body: [
      "Weekdays, calendar dates, relative timing, and times of day all parse. A weekday in the past rolls to the next one.",
      'Short names like mon–fri work on their own. "sat" and "sun" need a cue (on sat, next sun) so titles like "buy sun hat" stay intact.',
    ],
    examples: [
      "essay due dec 15",
      "call mom this weekend",
      "reply in 2 hours",
      "standup weds 9am",
      "laundry on sat",
    ],
  },
  {
    title: "Several things at once",
    body: [
      "Separate with commas or new lines. Each chunk can have its own date and area.",
    ],
    examples: ["email prof tomorrow #work, gym friday #personal, pay rent !"],
  },
  {
    title: "Folders (optional)",
    body: [
      "Folders group related tasks inside an area. Create them from an area page, or ask Plot.",
      "To nest an existing task: file it under a folder. Phrases like put X in Y folder still create a new task inside that folder.",
    ],
    examples: [
      "create folder for Travel",
      "file passport in Travel folder",
      "open folder Travel",
    ],
  },
  {
    title: "Follow-ups (optional)",
    body: [
      "Use a follow-up when you’re waiting on someone — not for every dated task.",
      "Undated “email jordan” may land as a follow-up. Change the type in the confirm sheet if that’s wrong.",
      "Stages like waiting / your turn are for those threads. Bare “bump jordan” still creates a new follow-up; say mark jordan waiting to update an existing one.",
    ],
    examples: [
      "follow up with jordan by friday",
      "mark jordan waiting",
      "your turn on jordan",
    ],
  },
  {
    title: "On-device parsing",
    body: [
      "Clear lines parse instantly with rules. Messier dumps may refine on-device if your phone supports it.",
      "The first model load can take a minute on Wi‑Fi; after that it’s quicker. No model? Rules still handle dates, areas, lists, and most commands.",
    ],
  },
  {
    title: "When something looks wrong",
    body: [
      "Edit in the confirm sheet, or use the date picker. Voice is a draft — quiet rooms work best.",
      "Stuck? Use a short line like “call jordan friday” and fix details after.",
    ],
  },
  {
    title: "Your data stays here",
    body: [
      "Everything lives on this device. Export JSON from Settings before you switch phones.",
      "On iPhone, install from Safari → Add to Home Screen for the full app experience.",
    ],
  },
];
