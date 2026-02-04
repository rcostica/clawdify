'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: 'What is Clawdify?',
    answer:
      'Clawdify is a Mission Control dashboard for AI coding agents powered by OpenClaw. You create tasks, your AI agent executes them — reading files, writing code, running commands — and you watch it all happen in real-time from your browser.',
  },
  {
    question: 'How is this different from ChatGPT or Claude?',
    answer:
      'ChatGPT and Claude are chat interfaces. Clawdify is a task-centric dashboard for autonomous AI agents. Instead of back-and-forth conversation, you give your agent a task ("Build a login page") and watch it actually do the work — creating files, installing dependencies, running your dev server. Think of it as giving an AI developer a ticket, not a prompt.',
  },
  {
    question: 'Do I need to set up a server?',
    answer:
      'No. With one-click deploy, you can have an agent running in 5 minutes on Railway or Fly.io — without touching a terminal. The agent runs on your cloud account (not ours), so you keep full control. Alternatively, if you already run an OpenClaw Gateway, you can connect it directly.',
  },
  {
    question: 'What does "Bring Your Own Gateway" (BYOG) mean?',
    answer:
      'If you already have an OpenClaw Gateway running on your own server, you can connect it to Clawdify by entering your WebSocket URL and token. This gives you the full dashboard experience with zero additional infrastructure. The Free plan supports BYOG.',
  },
  {
    question: 'Where do my API keys go?',
    answer:
      'Your API keys stay on your Gateway — on YOUR server or YOUR Railway/Fly.io account. Clawdify never sees, stores, or touches your API keys. You pay Anthropic or OpenAI directly.',
  },
  {
    question: 'What does the agent actually run on?',
    answer:
      'The AI agent (OpenClaw Gateway) runs on infrastructure you control. With one-click deploy, that means a container on your Railway or Fly.io account (typically $3-5/mo). With BYOG, it runs wherever you already have it — your laptop, a VPS, a home server. Clawdify itself is just the dashboard.',
  },
  {
    question: 'Is my data safe?',
    answer:
      'Yes. Your code, conversations, and API keys never touch our servers. The OpenClaw Gateway processes everything locally on your infrastructure. Clawdify connects via WebSocket to display the activity feed and results — but the actual work happens on your machine.',
  },
  {
    question: 'What AI models does it support?',
    answer:
      'Any model supported by OpenClaw — including Claude (Anthropic), GPT-4 (OpenAI), and others. You configure the model on your Gateway and bring your own API key. Clawdify is model-agnostic.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      "Yes. No contracts, no commitments. Cancel your Pro subscription anytime and you'll keep access until the end of your billing period. The free tier is always available.",
  },
  {
    question: 'What is OpenClaw?',
    answer:
      "OpenClaw is an open-source AI agent runtime — the engine that powers the agent behind Clawdify. It handles tool execution, file operations, shell commands, and communication with AI models. Think of OpenClaw as the engine and Clawdify as the cockpit.",
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
