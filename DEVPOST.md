# HumanLoop — Devpost submission

**Turn life's chaos into your next clear action.**

## Inspiration

Overwhelm is not a scheduling problem; it is a decision problem. When everything feels urgent, the hardest step is choosing what to do next. Most tools respond by asking for more input: another list, another tag, another system to maintain. We wanted the opposite — a tool that accepts a messy sentence and hands back one believable next step.

## What it does

HumanLoop is a closed loop for chaotic days:

- **Clarity:** describe what is going on in plain language. The Clarity Engine reflects the real bottleneck and returns a short plan with estimates, priorities, deadlines, and a concrete "done when".
- **Action:** review and edit the plan before adding tasks. Create, complete, reopen, search, and filter tasks in a real workspace.
- **Focus:** start a countdown timer that records only time that actually passes, then log the session.
- **Adapt:** when the day changes, check in with a signal and a note. HumanLoop proposes specific adjustments — reduce scope, split, defer, reschedule, add — and you apply each one deliberately.
- **Reflect:** close the day with a short reflection that names wins, unfinished work, and the single action for tomorrow.

Everything persists locally, works without an account, and the whole product is usable without an API key through a clearly labelled demo mode.

## How we built it

React 18 and Vite for the interface, a hand-written CSS design system (charcoal, lime, editorial type) instead of a UI framework, Express for the API, and Groq's OpenAI-compatible chat completions for the AI. The server asks for JSON only, validates every field, clamps ranges, normalizes dates, and makes one repair attempt before returning a structured error. The browser never sees the API key.

There is no database: the workspace lives in `localStorage`, and the server is stateless apart from an in-memory rate limiter. Hash routing keeps reloads and static hosting predictable.

## Challenges

- **Making AI output safe to render.** Models return plausible but malformed plans. We built a strict schema layer, a repair retry, and graceful error mapping so a bad response never becomes broken UI.
- **Honest demo mode.** Judges and users may not have a key. Rather than fake live AI, deterministic generators build samples from the user's own words, and the UI and API label them as demo output.
- **Real timers and real state.** The focus timer derives elapsed time from timestamps instead of counting ticks, so it stays correct across pauses and tab throttling.
- **Design without dependencies.** A complete dark-first design system, responsive layouts, dialogs, toasts, and charts with no component library.

## Accomplishments

- A complete five-stage product loop, not a single-screen demo.
- 25 unit tests, 9 HTTP smoke checks, and 12 headless-browser checks passing, including mobile layout and reload persistence.
- Zero console or runtime errors in the browser verification.
- A production build served by one Express process, with Docker and Render deployment files included.

## What we learned

Validation is a product feature, not backend hygiene: the quality of an AI product is mostly the quality of its failure states. We also learned to design the demo path first — if the product cannot explain itself without a key, it is not finished.

## What's next

Accounts and encrypted sync, calendar and email integrations, streaming with the same validation guarantees, recurring-blocker detection from reflection history, and a PWA with offline support.

## Built with

React, Vite, JavaScript, CSS, Node.js, Express, Groq, Docker.

## Try it

- Live app: `<add deployed URL>`
- Demo video: `<add 2–3 minute walkthrough link>`
- Source: `<add repository URL>`

Run locally with `npm install`, copy `.env.example` to `.env`, add `GROQ_API_KEY`, then `npm run dev`. Leave the key blank to explore demo mode. Full setup, architecture, and test commands are in the [README](README.md).
