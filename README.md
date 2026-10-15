# Aria: AI Voice Support Agent for Aura Skincare

Browser-based voice customer support agent. Click **Start Call**, speak, and Aria answers out loud. She follows Aura's brand policies, looks up live (mock) order data through tool calling, and produces a transcript plus structured JSON summary when the call ends.

## Architecture

```
Browser mic -> Web Speech API (STT, en-IN) -> POST /api/chat -> Gemini (system prompt + tools)
                                                                  |-- get_order_details(order_id)
                                                                  |-- check_return_eligibility(order_id)
                                                                  '-- cancel_order(order_id)
Browser speakers <- SpeechSynthesis (TTS, en-IN voice) <- reply text
End Call -> POST /api/summary -> Gemini -> JSON outcome + transcript
```

- `public/index.html` UI, state machine (Idle / Listening / Thinking / Speaking), STT, TTS, barge-in
- `lib/agent.js` system prompt, tool loop, summary generation
- `lib/orders.js` mock order DB and deterministic policy logic (return window, cancellability), plus order-ID normalisation ("ord one zero one" -> `ORD-101`)
- `api/*.js` Vercel serverless functions; `server.js` the same routes for local, Render, Railway

How guardrails work: policies live in the system prompt, and eligibility (7-day window, Processing-only cancellation) is computed in code and returned by tools, so the model reports facts rather than doing date maths. Out-of-scope requests, unknown order IDs, missing IDs, and low-confidence speech each have explicit rules. Tool results carry instructions like "ask the customer to repeat or verify the ID".

## Run locally

```bash
cp .env.example .env     # add GEMINI_API_KEY (free from aistudio.google.com/apikey)
npm start                # http://localhost:3000   (Node 18+, no dependencies)
npm test                 # order logic tests
```

Use Chrome or Edge (Firefox has no SpeechRecognition; the text box works as a fallback).

## Deploy

- **Vercel:** import the repo, set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`), deploy. No build step.
- **Render / Railway:** Node web service, start command `npm start`, same env vars.

## Test script

1. "Where is my order ORD-101?" -> tool call, out for delivery, 6 PM
2. "I bought ORD-102 and opened it, can I return it?" -> politely declined (14 days, outside 7-day window)
3. "Cancel ORD-103" -> allowed; "Cancel ORD-101" -> refused, offers refuse-at-doorstep
4. "Check ORD-555" -> not found, asks to verify
5. "Book me a flight to Goa" -> out of scope
6. Mumble or say something unclear -> asks to repeat
7. End Call -> transcript + JSON

Notes: `cancel_order` is a mock; sample data is read-only, so it validates and confirms but does not change stored status.

## Tell us how you think

> Edit these into your own words before submitting; you will be asked about them in the evaluation.

**1. Why this architecture and stack?** I used a modular pipeline: browser STT -> Gemini with tool calling -> browser TTS, behind one thin Node API. It needs a single API key, deploys in minutes, has no vendor lock-in, and each stage is easy to explain and swap. The trade-offs are that STT is Chrome/Edge-only and TTS voice quality depends on the device. I accepted that to spend my time on conversation logic, guardrails and tools rather than audio plumbing.

**2. Hardest part?** Turn-taking. The mic can pick up Aria's own voice, so I made a strict state machine (listening / thinking / speaking) with recognition paused while she speaks, and barge-in as an opt-in toggle for headphone users. The second hard part was spoken order IDs ("ord one oh one"), which I solved with a normaliser in code so tool lookups are reliable.

**3. One more week?** Latency first: stream the LLM response and start TTS sentence by sentence, then move to a server-side STT/TTS provider (more natural Indian voice, better Hinglish, real VAD). Latency and voice quality are what make a voice agent feel good or bad. Next I would add an automated conversation eval suite for policy edge cases.

**4. At 1,000 calls a day?** Customer verification before sharing order data (OTP or phone match), real order-system integration, rate limiting and abuse protection on the public endpoint, per-stage latency and cost monitoring, call recordings/transcripts stored with PII controls, human handoff for cases Aria cannot resolve, regression evals on every prompt change, and a provider fallback when the LLM or speech service is down.

## Submission

Email to ozair.shaikh@datastraw.in, aryan.jaiswal@datastraw.in, CC talent@datastraw.in. Subject: `AI Voice Agent Assignment - Yuvati Bhabal`. Include app URL, GitHub repo, demo video (3-5 min), LinkedIn link and a 2-3 sentence approach note.
