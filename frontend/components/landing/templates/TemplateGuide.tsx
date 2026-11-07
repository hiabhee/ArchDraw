import type { TemplateGuide } from '@/data/templates/guides';

const h2 = 'text-xl font-semibold tracking-[-.03em] text-text-primary';
const p = 'leading-7 text-text-secondary';

/** The written guide on a template page: overview, request flows, design decisions, scaling. */
export function TemplateGuideBody({ guide, subject }: { guide: TemplateGuide; subject: string }) {
  return (
    <div className="mx-auto max-w-3xl space-y-14 pt-14">
      <section aria-labelledby="overview-title">
        <h2 id="overview-title" className={h2}>How the {subject} architecture works</h2>
        <div className="mt-4 space-y-4">
          {guide.overview.map((para) => <p key={para.slice(0, 40)} className={p}>{para}</p>)}
        </div>
      </section>

      <section aria-labelledby="flows-title">
        <h2 id="flows-title" className={h2}>Request flow, step by step</h2>
        <div className="mt-4 space-y-8">
          {guide.flows.map((flow) => (
            <div key={flow.title}>
              <h3 className="text-base font-semibold text-text-primary">{flow.title}</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 marker:text-text-muted">
                {flow.steps.map((step) => <li key={step.slice(0, 40)} className={`pl-1 ${p}`}>{step}</li>)}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="decisions-title">
        <h2 id="decisions-title" className={h2}>Key design decisions</h2>
        <div className="mt-4 space-y-6">
          {guide.decisions.map((d) => (
            <div key={d.title}>
              <h3 className="text-base font-semibold text-text-primary">{d.title}</h3>
              <p className={`mt-2 ${p}`}>{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="scaling-title">
        <h2 id="scaling-title" className={h2}>How it scales</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 marker:text-text-muted">
          {guide.scaling.map((s) => <li key={s.slice(0, 40)} className={`pl-1 ${p}`}>{s}</li>)}
        </ul>
      </section>
    </div>
  );
}

/** Common questions about the system, answered on the page (and as FAQPage structured data). */
export function TemplateGuideFaq({ guide }: { guide: TemplateGuide }) {
  return (
    <section aria-labelledby="faq-title" className="mx-auto max-w-3xl pt-16">
      <h2 id="faq-title" className={h2}>Frequently asked questions</h2>
      <div className="mt-5 divide-y divide-border-default rounded-xl border border-border-default bg-surface-card">
        {guide.faq.map((item) => (
          <div key={item.question} className="px-5 py-4">
            <h3 className="text-sm font-semibold text-text-primary">{item.question}</h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{item.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function templateFaqJsonLd(guide: TemplateGuide) {
  return {
    '@type': 'FAQPage',
    mainEntity: guide.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}
