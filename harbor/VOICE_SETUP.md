# Harbor Voice: AI phone receptionist setup

Harbor has two phone modes. Use **Live** (it sounds human). **Classic** stays wired in as an automatic backup.

| | **Live mode** (recommended) | Classic mode (backup) |
|---|---|---|
| How it feels | Like talking to a real receptionist | Like a polite phone menu that understands speech |
| Starts replying | Almost immediately. Words stream out as Claude writes them | After the whole reply is ready (~1.5–3 s) |
| Interrupting | ✅ Talk over it any time and it stops instantly, then answers what you said | ❌ Waits for you to finish listening |
| "Uh-huh", "yeah" | Ignored, so it doesn't stop mid-sentence | n/a |
| Voice | ElevenLabs voices (very natural) | Amazon Polly Neural |
| Knowing when you're done | Smart end-of-turn detection, not just silence | Silence timeout |
| Hosting | Small always-on server (`voice-server/`) on Fly.io / Render / Railway | Vercel functions (`api/voice/*`) |

## How Live mode works
```
Caller ──► Twilio number ──POST──► voice-server /twiml  (returns <Connect><ConversationRelay>)
                                          │
        Twilio ConversationRelay ◄──WebSocket──► voice-server /relay
        • Deepgram speech-to-text                 • streams Claude's reply token by token
        • ElevenLabs voice                        • caller talks → "interrupt" → generation aborted,
        • barge-in + turn detection                 Claude told exactly what the caller heard
        • ignores backchannel ("uh-huh")          • tools: book_job, transfer_to_human, end_call
                                          │
        session ends ──POST──► voice-server /handoff   → transfer (Dial owner) or hang up
        call closes without a booking → missed-call text-back to the caller + owner alert
```

## Setup
1. **Business info:** edit `config/business.json` (company, prices, service area, hours). To choose a voice, paste an ElevenLabs voice ID into `live_voice.voice`. If you leave it empty, Twilio's default ElevenLabs voice is used.
2. **Deploy the live server** (from the `harbor/` folder):
   ```bash
   fly launch --no-deploy        # uses fly.toml; keeps 1 machine always on (no cold start)
   fly secrets set ANTHROPIC_API_KEY=... TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... \
     OWNER_PHONE=+15551234567 BOOKING_WEBHOOK_URL=https://hooks.zapier.com/... \
     PUBLIC_BASE_URL=https://harbor-live-voice.fly.dev
   fly deploy
   ```
   Render or Railway work too: run the Dockerfile at `voice-server/Dockerfile`, set the same variables, and keep at least one instance always on.
3. **Twilio:**
   - Turn on ConversationRelay for your account (Console → Voice → Settings) and accept the AI/ML features addendum. Live mode won't connect until you do.
   - On your number: *A call comes in* → `https://YOUR-LIVE-SERVER/twiml` (HTTP POST).
   - On your number: *Primary handler fails* → `https://YOUR-VERCEL-SITE/api/voice/incoming`. If the live server is ever down, calls fall back to Classic mode automatically.
   - Leave *Call status changes* empty in Live mode. The live server already sends missed-call text-backs, so setting it would double-text callers.
   - For US texting, register for A2P 10DLC.
4. **Forwarding:** the client forwards overflow or after-hours calls (or all calls) to the Twilio number.
5. **Test call checklist:** ask for a price, interrupt it mid-sentence, say "uh-huh" while it talks (it should keep going), book a fake job, check the confirmation text and owner alert, then say "I need a real person" to test the transfer.

## Tuning the feel
These are settings in `voice-server/server.js`, inside `relayTwiml()`:
- `interruptSensitivity`: `low` / `medium` / `high`. Raise it if callers say it talks over them. Lower it for noisy job sites.
- `ignorebackchannel`: on, so short "yeah"s don't stop it.
- `turnDetection`: on, so it can tell a mid-sentence pause from the caller being done.
- How it talks: `LIVE_VOICE_STYLE` in `api/_lib/receptionist.js` (short turns, contractions, "Oh no, okay." acknowledgments, numbers written the way they're said).

## Cost per client (rough, 300 calls × 3 min a month)
| Item | ~Monthly |
|---|---|
| Twilio voice + ConversationRelay (includes speech-to-text and ElevenLabs voice) | ~$70–$120 |
| Twilio SMS | ~$5–$10 |
| Claude API (short streamed turns, low effort) | ~$15–$40 |
| Live server (Fly.io, one small always-on machine, shared by all clients) | ~$5 total |
| **Per client** | **~$90–$170**, against $597 on the Growth plan (≈ 72–85% margin) |

Check Twilio's current ConversationRelay per-minute price before you set your own prices.

## Tests
```bash
npm run test:live-voice   # 20 checks over a real WebSocket: streaming, barge-in, echo of what was heard,
                          # booking, bad tool input, hang-up, text-back, AI-down fallback, signature check
npm run test:voice        # 12 checks for Classic mode
npm test                  # everything (site + both voice modes)
```

## Good to know
- The live server is shared. One instance can serve every client, because `config/business.json` holds the business details. For many clients, make that config per-number (look it up by the `to` number in `setup`).
- Each call's memory lives in that server's RAM for the call. That's fine at this scale.
- Callers are told it's an AI and that the call may be recorded. Keep that: it's required in many US states.
