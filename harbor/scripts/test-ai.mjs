// Tests the free-provider adapter (Gemini / Groq OpenAI-compatible APIs) with simulated responses.
import { compatClient, providerName, PROVIDERS } from "../api/_lib/ai.js";
const results = []; const ok = (n, c) => { results.push(!!c); console.log(`${c ? "✓" : "✗"} ${n}`); };

ok("Picks Claude when its key is set", providerName({ ANTHROPIC_API_KEY: "x", GEMINI_API_KEY: "y" }) === "anthropic");
ok("Picks Gemini when only its key is set", providerName({ GEMINI_API_KEY: "y" }) === "gemini");
ok("Picks Groq when only its key is set", providerName({ GROQ_API_KEY: "z" }) === "groq");
ok("AI_PROVIDER overrides", providerName({ AI_PROVIDER: "groq", ANTHROPIC_API_KEY: "x" }) === "groq");
ok("Gemini + Groq endpoints configured", PROVIDERS.gemini.base.includes("generativelanguage.googleapis.com") && PROVIDERS.groq.base.includes("api.groq.com"));

const sent = [];
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
let queue = [];
const fetchImpl = async (url, init) => { sent.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization }); return queue.shift()(); };
const c = compatClient({ baseURL: "https://ai.test/v1", apiKey: "KEY", model: "free-model", fetchImpl });

// 1) Plain answer with system prompt blocks
queue = [() => json({ choices: [{ message: { content: "We open at 10." }, finish_reason: "stop" }] })];
let r = await c.beta.messages.create({ model: "claude-opus-5-5", betas: ["x"], fallbacks: "default", system: [{ type: "text", text: "You are Harbor.", cache_control: { type: "ephemeral" } }], messages: [{ role: "user", content: "When do you open?" }], max_tokens: 100 });
ok("Sends the right model, key and system prompt", sent[0].body.model === "free-model" && sent[0].auth === "Bearer KEY" && sent[0].body.messages[0].content === "You are Harbor." && !("betas" in sent[0].body));
ok("Returns a Claude-shaped answer", r.stop_reason === "end_turn" && r.content[0].text === "We open at 10.");

// 2) Tool call round trip
queue = [() => json({ choices: [{ message: { content: "Booking it.", tool_calls: [{ id: "c1", type: "function", function: { name: "book", arguments: '{"name":"Ona","when":"Sat 10"}' } }] }, finish_reason: "tool_calls" }] })];
r = await c.messages.create({ messages: [{ role: "user", content: "book me" }], tools: [{ name: "book", description: "Book", input_schema: { type: "object", properties: { name: { type: "string" } } } }] });
ok("Translates tools and returns tool_use", sent[1].body.tools[0].function.name === "book" && r.stop_reason === "tool_use" && r.content[1].input.name === "Ona");
queue = [() => json({ choices: [{ message: { content: "Done!" }, finish_reason: "stop" }] })];
await c.messages.create({ messages: [{ role: "user", content: "book me" }, { role: "assistant", content: r.content }, { role: "user", content: [{ type: "tool_result", tool_use_id: "c1", content: "Booked" }] }] });
const m = sent[2].body.messages;
ok("Sends tool results back in the provider's format", m[1].tool_calls[0].id === "c1" && m[2].role === "tool" && m[2].tool_call_id === "c1" && m[2].content === "Booked");

// 3) Structured JSON, with fallback when strict schemas aren't supported
queue = [() => json({ error: "schema unsupported" }, 400), () => json({ choices: [{ message: { content: '{"reply":"hi"}' }, finish_reason: "stop" }] })];
r = await c.messages.create({ messages: [{ role: "user", content: "hi" }], output_config: { format: { type: "json_schema", schema: { type: "object", properties: { reply: { type: "string" } } } } } });
ok("Asks for a JSON schema, retries with plain JSON if refused", sent[3].body.response_format.type === "json_schema" && sent[4].body.response_format.type === "json_object" && sent[4].body.messages[0].content.includes("JSON Schema") && JSON.parse(r.content[0].text).reply === "hi");

// 4) Streaming text + a streamed tool call
const sse = lines => new Response(new ReadableStream({ start(ctl) { const e = new TextEncoder(); lines.forEach(l => ctl.enqueue(e.encode(`data: ${l}\n\n`))); ctl.close(); } }), { headers: { "content-type": "text/event-stream" } });
queue = [() => sse([
  JSON.stringify({ choices: [{ delta: { content: "Okay, " } }] }),
  JSON.stringify({ choices: [{ delta: { content: "let me book that." } }] }),
  JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "t9", function: { name: "book", arguments: '{"na' } }] } }] }),
  JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'me":"Jo"}' } }] }, finish_reason: "tool_calls" }] }),
  "[DONE]",
])];
const s = c.beta.messages.stream({ messages: [{ role: "user", content: "book" }], tools: [{ name: "book", input_schema: { type: "object" } }] });
let streamed = "";
for await (const ev of s) if (ev.type === "content_block_delta") streamed += ev.delta.text;
const fin = await s.finalMessage();
ok("Streams text token by token", streamed === "Okay, let me book that." && sent[5].body.stream === true);
ok("Assembles a streamed tool call", fin.stop_reason === "tool_use" && fin.content.find(b => b.type === "tool_use").input.name === "Jo");

// 5) Errors surface clearly
queue = [() => json({ error: "rate limited" }, 429)];
let err = null; try { await c.messages.create({ messages: [{ role: "user", content: "x" }] }); } catch (e) { err = e; }
ok("Reports provider errors (e.g. free-tier rate limit)", err?.status === 429);

const failed = results.filter(x => !x).length;
console.log(failed ? `\n${failed} AI adapter check(s) failed` : `\n✓ All ${results.length} AI adapter checks passed`);
process.exit(failed ? 1 : 0);
