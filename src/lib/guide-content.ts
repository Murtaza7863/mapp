export interface GuideSection {
  title: string;
  body: string[];
  examples?: string[];
}

export const GUIDE_INTRO =
  "Plotline works best when you know what to expect. These tips save the most frustration.";

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: "Always check before adding",
    body: [
      "The confirm sheet is not optional polish. It is your safety net.",
      "If the title still has a date in it, or the day looks wrong, fix it there before you tap Add. That is faster than retyping.",
    ],
  },
  {
    title: "Include a day or time when it matters",
    body: [
      "Plain tasks without a date are fine. When you care about when something happens, say it in the same line.",
    ],
    examples: [
      "email prof tomorrow #work",
      "meeting with shopee next tues 4pm",
      "pay rent friday !",
    ],
  },
  {
    title: "Ways to write a date",
    body: [
      "Weekdays, calendar dates, and rough timing all work. A date in the past rolls forward to the next one.",
      "Times of day count too: noon, midnight, and morning or evening once a day is set.",
    ],
    examples: [
      "essay due dec 15        submit taxes 5 apr",
      "call mom this weekend   gym next month",
      "lunch at noon           renew pass end of week",
      "reply in 2 hours        dentist in 3 days",
    ],
  },
  {
    title: "Short weekday names",
    body: [
      "Most abbreviations are understood on their own: mon, tues, weds, thurs, fri.",
      'Because "sat" and "sun" are ordinary words, they only count as days after a cue. That keeps "study sat exam" and "buy sun hat" intact.',
    ],
    examples: ["standup weds 9am", "laundry on sat", "brunch next sun"],
  },
  {
    title: "Areas and priority",
    body: [
      "Tag an area with # and the first letters of its name. Add ! for priority.",
    ],
    examples: ["submit essay #work", "dentist tuesday #personal"],
  },
  {
    title: "Several tasks at once",
    body: [
      "Separate items with commas. Each chunk can have its own date and area.",
    ],
    examples: ["email prof tomorrow #work, gym friday #personal, pay rent !"],
  },
  {
    title: "Follow-ups are optional",
    body: [
      "A follow-up is for someone you need to ping again — not a dated deadline. Most days you can ignore More → Follow-ups entirely.",
      'Dated lines like "call mom sunday" stay normal tasks. Undated "email jake" or explicit "follow up with…" may land as a follow-up. Change the type in the confirm sheet if that is wrong.',
    ],
  },
  {
    title: "On-device parsing",
    body: [
      "Clear phrasing is handled instantly. Messier dumps may refine on-device if your phone supports it.",
      "The first model load can take a minute on WiFi. After that, parsing is much quicker.",
      "No model or slow device? Rules still handle dates, areas, and comma lists. You are not blocked.",
    ],
  },
  {
    title: "When something looks wrong",
    body: [
      "Edit the title and date in the confirm sheet. Use the date picker if the time is off.",
      "Voice works best in a quiet spot. Mic input is a draft, not a final answer.",
      'If you are stuck, add the task with a simple line like "call jake friday" and fix details after.',
    ],
  },
  {
    title: "Your data stays here",
    body: [
      "Everything is stored on this device. Export JSON in Settings before you switch phones.",
      "Install from Safari (Add to Home Screen) for the full app experience on iPhone.",
    ],
  },
];
