# Harbor Voice: AI phone receptionist setup

Harbor answers real phone calls. It understands what the caller says, answers with Claude, books the job, texts confirmations,
transfers emergencies to a human, and texts back anyone who hung up without booking.

```
Caller ──► Twilio number ──► /api/voice/incoming   greeting + "this is an AI assistant" + recording notice
                │                     │
                │            /api/voice/turn  ◄──┐   Twilio speech-to-text → Claude (tools: book_job,
                │                     │          │   transfer_to_human, end_call) → Twilio voice
                │                     └──────────┘   loops until booked / transferred / goodbye
                └──► /api/voice/status (call ended) → missed-call text-back if no booking
```

## Setup per client (about 20 minutes)
1. **Business info:** edit `config/business.json` with the company name, service area, prices, hours and booking windows. This is the only file that changes per client.
2. **Twilio:** create an account, buy a local number (~$1.15/mo), then open the number's settings:
   - *A call comes in* → Webhook → `https://YOUR-DOMAIN/api/voice/incoming` (HTTP POST)
   - *Call status changes* → `https://YOUR-DOMAIN/api/voice/status` (HTTP POST)
   - For US texting, register the number for A2P 10DLC (Twilio walks you through it). Texts won't deliver reliably without it.
3. **Vercel environment variables:**

| Variable | What it's for |
|---|---|
| `ANTHROPIC_API_KEY` | Claude, which does the thinking |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Sending texts and checking that requests really come from Twilio |
| `OWNER_PHONE` | The owner's or on-call tech's cell, in `+15551234567` format, for transfers and job alerts |
| `BOOKING_WEBHOOK_URL` | Where bookings go: a Zapier/Make webhook into Google Calendar, Jobber, Housecall Pro or a sheet. If you leave it out, `LEAD_WEBHOOK_URL` is used. |
| `PUBLIC_BASE_URL` | Optional. Your public URL (e.g. `https://harbor.yourdomain.com`), needed if the request check fails behind a proxy |

4. **The client's phone:** set call forwarding to the Twilio number. Use "forward when busy or no answer" so Harbor only takes overflow, or "forward all" for 24/7.
5. **Test:** call the number and book a fake job. Check that the confirmation text, the owner alert and the webhook row all arrive.

## Cost per client (rough)
| Item | ~Monthly cost at 300 calls × 3 min |
|---|---|
| Twilio voice (inbound + speech recognition) | ~$40–$60 |
| Twilio SMS | ~$5–$10 |
| Claude API (short turns, low effort) | ~$15–$40 |
| **Total** | **~$60–$110**, compared with $597 revenue on the Growth plan (≈ 82–90% margin) |

## Tests
```bash
npm run test:voice   # 12 checks on a simulated call: greeting, booking, texts, transfer/hang-up, silence, AI-down fallback
```

## Known limits and next upgrades
- **Voice quality:** it uses Amazon Polly Neural voices through Twilio `<Say>`. For an even more human sound with interruptions ("barge-in"), the next step is Twilio Media Streams with a streaming speech engine. That needs a small always-on WebSocket server (Fly.io/Render), not Vercel.
- **Delay:** there's about 1.5–3 seconds of thinking per reply. That's fine for booking calls. The streaming upgrade above brings it under 1 second.
- **Call memory:** the conversation is kept in a cookie for one call, plus a per-server cache. For high volume, move it to Redis/Upstash.
- **Calendar:** right now booking goes out through a webhook. Direct Google Calendar, Jobber or ServiceTitan APIs would come next.
