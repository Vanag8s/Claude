# Go live: from demo to a business people pay for

Harbor's code is finished for all of this. Each step below needs an account in **your** name, because it involves money or a phone number. Budget: about 2 hours and about $10 to start.

| # | What | Why | Cost |
|---|---|---|---|
| 1 | **AI key**: Gemini (free) or Claude (best) | The brain: understands, answers, sells | Free / ~1–2¢ per message |
| 2 | **Vercel**: hosts the website | People can visit it | Free |
| 3 | **Upstash**: a small database | Remembers each business's info | Free |
| 4 | **Fly.io**: hosts the live voice server | Real-time phone calls | ~$5/month total |
| 5 | **Twilio**: phone number + calls | Customers call it | ~$1/month + ~1–2¢/min |
| 6 | **Stripe**: payment links | Members pay you monthly | 2.9% + 30¢ per payment |

---

## 1. Get an AI key
- **Free:** go to aistudio.google.com, sign in, then **Get API key → Create API key**. You'll use it as `GEMINI_API_KEY`. The free tier is great for testing. Before real customers call, switch to a paid key, because Google may use free-tier data to improve its products.
- **Best quality:** go to console.anthropic.com, add $5 credit, then **API Keys → Create**. You'll use it as `ANTHROPIC_API_KEY`.

Harbor picks whichever key it finds.

## 2. Put the website on Vercel
1. vercel.com → sign up with GitHub → **Add New → Project** → choose this repository.
2. **Root Directory:** `harbor`. Click **Deploy**.
3. **Settings → Environment Variables:** add your AI key, plus the ones in steps 3 and 5.
4. Optional: add your own domain under **Settings → Domains**.

## 3. Create the database (Upstash)
upstash.com → **Create Database** (Redis, free) → copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` → add both to **Vercel** and to **Fly** (step 4).

## 4. Put the live voice server on Fly.io
```bash
cd harbor
fly launch --no-deploy            # uses fly.toml; keeps one machine always on
fly secrets set GEMINI_API_KEY=... TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... \
  UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... \
  OWNER_PHONE=+1... PUBLIC_BASE_URL=https://harbor-live-voice.fly.dev
fly deploy
```

## 5. Get a phone number (Twilio)
1. twilio.com → sign up. The free trial gives credit and can call your own verified phone.
2. **Phone Numbers → Buy a number.**
3. **Voice → Settings:** turn on **ConversationRelay** and accept the AI features addendum.
4. Connect the number to Harbor with one command:
   ```bash
   TWILIO_ACCOUNT_SID=AC... TWILIO_AUTH_TOKEN=... npm run twilio:connect -- \
     --number +15550100 --voice https://harbor-live-voice.fly.dev --site https://your-site.vercel.app
   ```
5. **Call the number.** You're talking to Harbor. Interrupt it, ask a price, try to buy something.

For the website's "Call me" demo, also add `DEMO_FROM_NUMBER`, `LIVE_VOICE_URL` and `DEMO_ALLOWED_PREFIXES` to Vercel (see `VOICE_SETUP.md`).

## 6. Take payments (Stripe)
1. stripe.com → **Product catalog → Add product**: Shore $149/mo, Tide $349/mo, Ocean $899/mo (plus yearly prices if you want them).
2. **Payment Links → New** for each one, then paste the links into `config/plans.json`.
3. Redeploy. The membership buttons now go straight to checkout.

## 7. Sign up your first business (for example a waterpark)
1. On a call with the owner, open **/setup.html** and paste their website, or write down what they tell you: hours, prices, age rules, what to sell.
2. Pick **Sales** if they want Harbor to sell, then pick **Woman** or **Man** for the voice.
3. Test it together in the chat on the right, then **Save**.
4. Buy them a Twilio number, run `npm run twilio:connect`, put the number in their profile, and save again.
5. They forward their calls to that number (when busy, after hours, or always). Done.

---

### Voices
- **Website demo:** uses the voices on the visitor's device. Choose Woman/Man; "More voices" lists everything available. Microsoft Edge has the most natural free voices (marked ★), and Safari's premium voices are also good.
- **Phone:** Google Chirp3 HD voices, natural and interruptible: **Aoede** (woman) or **Charon** (man), set per business on the setup page. For your own custom or cloned voice, put an ElevenLabs voice ID in `config/business.json` → `live_voice.voice`.
- **Lithuanian phone calls:** Twilio currently lists only one standard (less natural) Lithuanian voice, a man's voice. Test it before you sell in Lithuanian; ElevenLabs may sound better.
