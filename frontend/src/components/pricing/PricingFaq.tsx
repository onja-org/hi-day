import { TRIAL_PROMISE } from "@/lib/pricing";

const QUESTIONS = [
  {
    question: "Why only one plan?",
    answer:
      "Because you shouldn't need a spreadsheet to pick time tracking. Every Cloud team gets every feature for the same price per person.",
  },
  {
    question: "Who counts as a person?",
    answer: "Anyone who tracks time.",
  },
  {
    question: "Is there a free trial?",
    answer: `Yes. Hi Day Cloud starts with a ${TRIAL_PROMISE.toLowerCase()}`,
  },
  {
    question: "Why pay when the code is free?",
    answer:
      "You're paying for us to run Hi Day well: servers, security fixes, updates, backups and support.",
  },
];

export function PricingFaq() {
  return (
    <section className="border-b-3 border-ink">
      <div className="mx-auto flex max-w-220 flex-col gap-7 px-6 py-24">
        <h2 className="font-display text-heading font-extrabold tracking-heading">Pricing questions</h2>
        <div className="flex flex-col gap-4">
          {QUESTIONS.map((item) => (
            <div
              key={item.question}
              className="flex flex-col gap-1.5 rounded-brand border-3 border-ink bg-white px-6 py-5 shadow-hard-sm"
            >
              <h3 className="font-display text-xl font-extrabold tracking-heading">{item.question}</h3>
              <p className="text-ink-muted">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
