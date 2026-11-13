# Start selling Harbor: the exact steps

Do these in order. Each step says what to do, where, and how you know it's done.
Technical commands are in `GO_LIVE.md`.

---

## Phase 1 — Decide and register (1–3 days)

**1. Pick your first market.**
- **Lithuania:** prices in euros, Lithuanian site and receptionist, Lithuanian phone numbers. Your direct competitor is atsiliepsiu.lt ("Agnė"), and Harbor does more than it: it books, sells, transfers calls and texts back.
- **Abroad, in English:** more customers, more competition.
- Done when: you've written down one country and one niche to start with (for example "dental clinics in Vilnius" or "leisure parks and spas").

**2. Register so you can take payments legally.**
- In Lithuania the simplest is an **individual activity certificate** (*individuali veikla pagal pažymą*), registered in **Mano VMI**. Or set up an **MB** (small partnership) if you plan to grow or want limited liability.
- Open a **business bank account**.
- Ask an accountant about VAT: you must register once your yearly revenue passes the threshold.
- Done when: you have your activity or company number and a bank account.

**3. Set your prices.**
- The site says Shore $149, Tide $349, Ocean $899. For Lithuania, consider about €99 / €249 / €599 (Agnė is cheaper but only takes messages).
- Check your cost per customer: roughly €40–€150 a month (calls, AI, texts). Your price must stay at least 3× that.
- Done when: you've written down 3 prices. Tell Claude to change the site to them, and to euros.

---

## Phase 2 — Create the accounts (1 evening, about €50 to start)

**4. Create the accounts, all in your own name.** Done when you have logins for all six:

| Account | Where | What you'll need from it |
|---|---|---|
| AI | console.anthropic.com (add €20 credit) | API key (`sk-ant-...`) |
| Website hosting | vercel.com (sign in with GitHub) | project |
| Database | upstash.com → Redis → Create | REST URL + token |
| Voice server | fly.io (add a card; about €5/month) | app |
| Phone | twilio.com (**upgrade from trial**, add €20) | Account SID, Auth Token, phone number |
| Payments | stripe.com (activate with your business details and bank account) | payment links |

- Use **paid** AI for real customers. The free Gemini tier is fine for testing only, and Google's terms may restrict it in the EU.
- A Twilio **trial** can only call your own verified number and plays a trial message first, so upgrade it before customers call.
- Lithuanian (+370) Twilio numbers need a **regulatory bundle**: Twilio asks for your business address and documents, and approval takes a few days. Start this early.

---

## Phase 3 — Launch the system (1 day)

**5. Put the website online (Vercel).**
- Import the GitHub repo and set **Root Directory** = `harbor`.
- Add environment variables: `ANTHROPIC_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `LEAD_WEBHOOK_URL` (see step 9).
- Done when: your `.vercel.app` address opens the beach site.

**6. Put the voice server online (Fly.io).** In a terminal, run the commands in GO_LIVE.md step 4.
- Done when: `https://<your-app>.fly.dev/health` shows `ok`.

**7. Connect your Twilio number.**
- Twilio Console → Voice → Settings → turn on **ConversationRelay** and accept the AI addendum.
- Run `npm run twilio:connect -- --number +... --voice https://<your-app>.fly.dev --site https://<your-site>`.
- Done when: you call the number and Harbor answers, and you can interrupt it.

**8. Make it yours.**
- Buy a domain (around €10 a year) and add it in Vercel → Domains.
- Ask Claude to replace `harbor-ai.example` everywhere with it.
- Ask a lawyer to check `legal/privacy.html` and `legal/terms.html`. In the EU: GDPR, the AI disclosure (Harbor already says it's an AI), and call recording notice.
- Done when: your domain works and the legal pages are approved.

**9. Get notified of every lead.**
- In Zapier or Make, create a webhook that sends to your email or a Google Sheet.
- Put its address in `LEAD_WEBHOOK_URL` (Vercel) and `BOOKING_WEBHOOK_URL` (Fly).
- Done when: sending the sign-up form on your site emails you.

**10. Turn on payments.**
- Stripe → Product catalog: create Shore, Tide and Ocean as monthly subscriptions → Payment Links → copy the three links into `config/plans.json` → push.
- Turn on Stripe's customer portal, so members can cancel by themselves.
- Done when: clicking "Join Tide" opens Stripe checkout, and a test-mode payment succeeds.

---

## Phase 4 — Test it yourself (1 day)

**11. Make your own demo business.** On `/setup.html`, use the example waterpark or a real business you know well, set its number to your Twilio number, and save.

**12. Call it 10 times and tick each off:**
- [ ] Ask the opening hours
- [ ] Ask an age or policy question (for example "Can a 14-year-old come alone?")
- [ ] Ask a price, then say "that's too expensive"
- [ ] Buy something: you get a sale text on the owner phone
- [ ] Book something: the caller gets a confirmation text
- [ ] Interrupt it mid-sentence
- [ ] Say "uh-huh" while it talks (it should keep going)
- [ ] Ask for a real person (it transfers to the owner phone)
- [ ] Hang up early (you get a text-back)
- [ ] Ask something it doesn't know (it should not guess)

Fix anything that feels off with Claude before showing it to anyone.

---

## Phase 5 — Find and sign your first customers (weeks 1–4)

**13. Build a list of 50 businesses in your niche:** name, phone, website, owner's name.

**14. Mystery-call them** at busy times (lunch, evenings, Saturday). Write down who didn't answer. That's your proof: "I called you 3 times, and nobody answered twice."

**15. Contact them by phone, visit or email.** Short version:
> "Hi, I'm [name]. I called your business 3 times this week and twice nobody picked up. Those are lost bookings. I set up an AI receptionist for businesses like yours. It answers every call, books, and texts you a summary. Can I show you in 2 minutes? I'll build it on your own website while we talk."

**16. Demo on the spot.**
- On your site's "Paste your website" section, type their address and let them talk to *their* receptionist.
- Or have it call their phone ("Call me").

**17. Close.**
- Offer the first month free, or the "pays off in 30 days or it's free" promise. Make a founding-client price for the first 10.
- Send the Stripe link or sign them up on the spot.
- Done when: your first payment arrives.

---

## Phase 6 — Set up each new customer (about 1 hour each)

**18. On a call with the owner**, open `/setup.html`:
- Paste their website or write down what they say: hours, prices, rules, FAQs, and what to sell.
- Pick **Receptionist** or **Sales**, and **Woman** or **Man** for the voice.
- Test it together in the chat, then **Save**. Keep their admin key safe.

**19. Give them a number.**
- Buy a Twilio number for them, run `npm run twilio:connect`, then put the number in their profile and save.

**20. Forward their calls.** The owner sets call forwarding on their phone:
- **Only when busy or unanswered (most common):** usually `**61*<Harbor number>#` (no answer) and `**67*<Harbor number>#` (busy).
- **All calls:** `**21*<Harbor number>#`.
- Codes can differ by operator (Telia, Tele2, Bitė), so check with theirs.

**21. Do a test call together.** Then check that the owner gets the summary text.

---

## Phase 7 — Keep customers happy (every week)

**22. Every week:**
- Look through call summaries for mistakes, and update the business's info.
- Send each owner a short note: calls answered, bookings, and sales.
- Check costs in Twilio, your AI account and Fly against what each customer pays.
- Ask happy customers for a review or a quote you're allowed to put on your site. These are real testimonials, never invented ones.

---

### Monthly costs at the start
- Fixed: Fly about €5, plus a domain of about €1/month.
- Per customer: Twilio number €1–€3, call minutes, AI (about €0.15–0.25 per 3-minute call) and texts.
- 10 customers on Tide (€249) = €2,490/month revenue, against roughly €400–€900 in costs.
