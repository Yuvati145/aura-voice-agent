# Aria: AI Voice Support Agent for Aura Skincare

A browser-based AI voice customer support agent for a fictional D2C skincare brand, **Aura Skincare**. Click **Start call**, speak, and Aria answers out loud. She follows the brand's policies, looks up order data through tool calling, and produces a transcript and a structured JSON summary when the call ends.

- **Live app:** https://aura-voice-agent-eta.vercel.app/
- **Repository:** https://github.com/Yuvati145/aura-voice-agent
- **Demo video (3–5 min):** https://drive.google.com/drive/folders/1WKH1-OI4dqzCsRAimQNljvajj0Qv5KLp?usp=sharing
- **Author:** Yuvati Bhabal ([LinkedIn](https://www.linkedin.com/in/yuvati-bhabal-032b13314/))

## Approach note

I built Aria as a modular pipeline. Browser speech recognition feeds a Gemini model with tool calling for order lookup, return eligibility and cancellation, and the reply is spoken back with browser text-to-speech. Brand policies are in the system prompt, and the eligibility rules are computed in code so Aria never guesses dates or promises refunds outside policy. After the call, the app shows the transcript and a structured JSON summary.

> Use Chrome or Edge. Firefox has no SpeechRecognition support, but the text box works as a fallback. Allow microphone access when asked.

## Features

- **Natural voice conversation** in an Indian-English voice (en-IN), with short replies and context kept across turns.
- **Live state indicator:** Listening, Thinking, Speaking.
- **Order lookup with tool calling** against a mock order database (ORD-101, ORD-102, ORD-103).
- **Brand guardrails:** returns, cancellation, shipping and COD policies are enforced, not just repeated.
- **Graceful degradation:** unknown or missing order IDs, unclear speech and out-of-scope requests are handled politely.
- **Post-call summary:** chronological transcript plus structured JSON (intent, order ID, resolution status, policy enforced, summary).
- **Test helper panel** on the page with the sample orders and one-tap example prompts.
- **Extras:** optional barge-in (interrupt Aria, best with headphones), Hinglish replies, typed-message fallback, spoken order IDs like "ord one zero one" understood.

## Architecture

```
Browser mic -> Web Speech API (STT, en-IN) -> POST /api/chat -> Gemini (system prompt + tools)
                                                                  |-- get_order_details(order_id)
                                                                  |-- check_return_eligibility(order_id)
                                                                  '-- cancel_order(order_id)
Browser speakers <- SpeechSynthesis (TTS, en-IN voice) <- reply text
End Call -> POST /api/summary -> Gemini -> JSON outcome + transcript
```

| File | Role |
|---|---|
| `public/index.html` | UI, state machine (Idle / Listening / Thinking / Speaking), STT, TTS, barge-in |
| `lib/agent.js` | System prompt, tool-calling loop, summary generation |
| `lib/orders.js` | Mock order DB, deterministic policy logic, order-ID normalisation |
| `api/*.js` | Vercel serverless functions (`/api/chat`, `/api/summary`) |
| `server.js` | The same routes for local use, Render or Railway |
| `test/orders.test.js` | Tests for order and policy logic |

### How the guardrails work

- Policies live in the system prompt as the only source of truth.
- Eligibility (7-day return window, Processing-only cancellation) is **computed in code** and returned by the tools, so the model reports facts instead of doing date maths.
- Explicit rules cover out-of-scope requests, unknown order IDs, missing IDs, requests to ignore the rules, and low-confidence speech.
- Tool results carry instructions such as "ask the customer to repeat or verify the ID".

### How the agent decides to use a tool

The model is given three tool declarations. When a customer asks about an order, Gemini returns a function call instead of text. The server runs the matching function, sends the result back to the model, and the model then phrases the answer naturally. The loop repeats up to 5 times per turn.

## Mock order data

| Order | Customer | Product | Value | Status | Notes |
|---|---|---|---|---|---|
| ORD-101 | Priya Sharma | Vitamin C Serum (30ml) | ₹699 | Out for Delivery | BlueDart BD-982103, expected by 6 PM today |
| ORD-102 | Rahul Verma | Hydrating Sunscreen SPF 50 | ₹499 | Delivered | Delhivery DL-441029, delivered 14 days ago |
| ORD-103 | Ananya Patel | Green Tea Face Wash + Toner | ₹850 | Processing | Ordered 3 hours ago, eligible for cancellation |

## Setup

Requires Node 18+. There are no dependencies to install.

```bash
git clone https://github.com/Yuvati145/aura-voice-agent.git
cd aura-voice-agent
cp .env.example .env     # on Windows PowerShell: Copy-Item .env.example .env
# edit .env and set GEMINI_API_KEY (free key: https://aistudio.google.com/apikey)
npm start                # http://localhost:3000
npm test                 # order logic tests
```

No telephony is needed: the whole experience runs in the browser.

Environment variables (see `.env.example`):

| Variable | Required | Default |
|---|---|---|
| `GEMINI_API_KEY` | Yes | none |
| `GEMINI_MODEL` | No | `gemini-3.5-flash` |
| `PORT` | No | `3000` |

Never commit your `.env` file. It is listed in `.gitignore`.

## Deployment

- **Vercel (used for the live app):** import the repo, add `GEMINI_API_KEY` under Environment Variables, deploy. No build step.
- **Render / Railway:** Node web service, start command `npm start`, same environment variables.

## Test script

1. "Where is my order ORD-101?" -> tool call, out for delivery, expected by 6 PM.
2. "I bought ORD-102 and opened it, can I return it?" -> politely declined (delivered 14 days ago, outside the 7-day window).
3. "Cancel ORD-103" -> allowed. "Cancel ORD-101" -> refused, suggests refusing delivery at the door.
4. "Check ORD-555" -> not found, asks to verify the ID.
5. "Book me a flight to Goa" -> out of scope.
6. Mumble or say something unclear -> asks to repeat.
7. End call -> transcript and JSON summary.

`cancel_order` is a mock: the sample data is read-only, so it validates and confirms but does not change stored status.

## Tell us how you think

**1. Why did you choose this architecture and technology stack?**
I used a modular pipeline: browser speech-to-text, then Gemini with tool calling, then browser text-to-speech, behind one thin Node API. It needs a single API key, deploys in minutes, has no vendor lock-in, and each stage is easy to explain and swap. The trade-offs are that speech recognition only works in Chrome and Edge, and TTS voice quality depends on the user's device. I accepted that so I could spend my time on conversation logic, guardrails and tools instead of audio plumbing.

**2. What was the most difficult part, and how did you solve it?**
Turn-taking. The microphone can pick up Aria's own voice, so I built a strict state machine (listening, thinking, speaking) with recognition paused while she speaks, and made barge-in an opt-in toggle for headphone users. The second hard part was spoken order IDs like "ord one oh one". I solved it with a normaliser in code so tool lookups are reliable.

**3. If you had one more week, what would you improve first and why?**
Latency. I would stream the LLM response and start TTS sentence by sentence, then move to a server-side STT/TTS provider for a more natural Indian voice, better Hinglish and proper voice activity detection. Latency and voice quality are what make a voice agent feel good or bad. After that I would add an automated conversation eval suite for policy edge cases.

**4. At 1,000 conversations a day, what would need to change?**
- Customer verification (OTP or phone match) before sharing order data.
- Integration with the real order system instead of mock data.
- Rate limiting and abuse protection on the public endpoint.
- Per-stage latency and cost monitoring.
- Call recordings and transcripts stored with PII controls.
- Human handoff for cases Aria cannot resolve.
- Regression evals on every prompt change.
- A fallback provider if the LLM or speech service goes down.

## License

MIT
