'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: 'How is this different from ChatGPT?',
    answer:
      'Clawdify gives you access to Claude, GPT-4, and Gemini in one organized workspace — not just a single model. Your conversations are organized by project instead of a flat list, and you can self-host for full privacy. All of this for $15/mo, less than ChatGPT Plus or Claude Pro alone.',
  },
  {
    question: 'Is my data safe?',
    answer:
      'Yes. With the self-hosted option, conversations never leave your own server. The OpenClaw relay is open source so you can inspect the code. Even with our hosted mode, we use encrypted connections and never train on your data. End-to-end encryption is on our roadmap.',
  },
  {
    question: 'Do I need to run my own server?',
    answer:
      'No. Clawdify works in hosted mode with zero setup — just sign up and start chatting. Self-hosting via the OpenClaw Gateway is entirely optional for users who want maximum privacy and control.',
  },
  {
    question: 'What AI models are included?',
    answer:
      'The free tier includes Gemini Flash. The Pro plan ($15/mo) unlocks Claude (Anthropic), GPT-4 (OpenAI), and Gemini Pro (Google). You can switch models per conversation.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes. There are no contracts or commitments. Cancel your Pro subscription anytime and you\'ll keep access until the end of your billing period. Your data is always exportable.',
  },
  {
    question: 'What is OpenClaw?',
    answer:
      'OpenClaw is the open-source AI engine that powers Clawdify\'s backend. It handles the connection between your browser and AI models. You can run it on your own hardware for full privacy, or use Clawdify\'s hosted version.',
  },
];

function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border/50">
      <button
        className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-foreground"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="font-medium">{question}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      <div
        className={cn(
          'grid transition-all duration-200',
          open ? 'grid-rows-[1fr] pb-5' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}

export function Faq() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            FAQ
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
        </div>

        <div className="mt-12">
          {faqs.map((faq) => (
            <FaqItem
              key={faq.question}
              question={faq.question}
              answer={faq.answer}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
