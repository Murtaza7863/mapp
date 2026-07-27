/** Curated Plot examples that show off rules + on-device LLM — great for demos. */
export interface PlotDemoPrompt {
  label: string;
  text: string;
  /** Hint for the wow moment judges should watch for */
  wow: string;
}

export const PLOT_DEMO_PROMPTS: PlotDemoPrompt[] = [
  {
    label: "Messy call note",
    text: "just finished call with acme corp, need to follow up with them by next friday for ATLAS",
    wow: "Extracts contact, date, and area from rambling prose",
  },
  {
    label: "Structure + hierarchy",
    text: "new area ATLAS (Sponsors, Events) Fall Outreach sponsors: email venue by monday",
    wow: "Creates area, folder, subgroup, and task in one shot",
  },
  {
    label: "Multi-task dump",
    text: "email prof tomorrow #work, gym friday #personal, pay rent !",
    wow: "Splits comma list with dates, areas, and priority",
  },
  {
    label: "Folder + task",
    text: "create a folder for Visa and add passport scan by friday",
    wow: "Feature intent (folder) plus nested task",
  },
];
