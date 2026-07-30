import { PageHeader } from "../components/ui";
import { APP_NAME } from "../config";
import { GUIDE_INTRO, GUIDE_SECTIONS } from "../lib/guide-content";

export function GuideView() {
  return (
    <div>
      <PageHeader
        title="How to use"
        subtitle={`Plot is the command bar for ${APP_NAME}`}
      />

      <p className="text-muted mb-5 text-sm leading-relaxed">{GUIDE_INTRO}</p>

      <div className="space-y-4">
        {GUIDE_SECTIONS.map((section) => (
          <section key={section.title} className="glass-card rounded-2xl p-4">
            <h2 className="text-primary mb-2 text-[15px] font-semibold">
              {section.title}
            </h2>
            <div className="text-muted space-y-2 text-sm leading-relaxed">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            {section.examples && section.examples.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {section.examples.map((example) => (
                  <li
                    key={example}
                    className="border-rule bg-paper rounded-lg border px-2.5 py-1.5 font-mono text-[11px] leading-snug text-[var(--color-block)]"
                  >
                    {example}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
