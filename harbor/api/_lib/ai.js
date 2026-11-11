// Picks the AI provider from whichever key is set, so Harbor runs on Claude or on a free alternative.
//   ANTHROPIC_API_KEY → Claude (best quality)
//   GEMINI_API_KEY    → Google Gemini (free tier via Google AI Studio)
//   GROQ_API_KEY      → Groq (free tier, very fast)
// Force one with AI_PROVIDER=anthropic|gemini|groq, and pick a model with AI_MODEL.
//
// Gemini and Groq both offer OpenAI-compatible chat APIs. The adapter below translates
// Harbor's Claude-style requests (system, messages, tools, JSON schemas, streaming) to that
// format and returns Claude-shaped responses, so the rest of the code doesn't change.
import Anthropic from "@anthropic-ai/sdk";

export const PROVIDERS = {
  gemini: { base: "https://generativelanguage.googleapis.com/v1beta/openai", key: "GEMINI_API_KEY", model: "gemini-2.5-flash" },
  groq: { base: "https://api.groq.com/openai/v1", key: "GROQ_API_KEY", model: "llama-3.3-70b-versatile" },
};

export function providerName(env = process.env) {
  if (env.AI_PROVIDER) return env.AI_PROVIDER;
  if (env.ANTHROPIC_API_KEY) return "anthropic";
  if (env.GEMINI_API_KEY) return "gemini";
  if (env.GROQ_API_KEY) return "groq";
  return "anthropic";
}

let cached;
export function getAI() {
  if (cached) return cached;
  const name = providerName();
  if (name === "anthropic") return (cached = new Anthropic());
  const p = PROVIDERS[name];
  if (!p) throw new Error(`Unknown AI_PROVIDER "${name}"`);
  return (cached = compatClient({ baseURL: process.env.AI_BASE_URL || p.base, apiKey: process.env[p.key], model: process.env.AI_MODEL || p.model }));
}

/* ---------------- Claude-shaped client over an OpenAI-compatible API ---------------- */

const systemText = s => (Array.isArray(s) ? s.map(b => b.text || "").join("\n") : String(s || ""));

function toOpenAI(params, model) {
  const msgs = [];
  const sys = systemText(params.system);
  if (sys) msgs.push({ role: "system", content: sys });
  for (const m of params.messages || []) {
    if (m.role === "system") { msgs.push({ role: "system", content: typeof m.content === "string" ? m.content : systemText(m.content) }); continue; }
    if (typeof m.content === "string") { msgs.push({ role: m.role, content: m.content }); continue; }
    const blocks = m.content || [];
    if (m.role === "assistant") {
      const text = blocks.filter(b => b.type === "text").map(b => b.text).join("");
      const calls = blocks.filter(b => b.type === "tool_use").map(b => ({ id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));
      msgs.push({ role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) });
    } else {
      for (const b of blocks) {
        if (b.type === "tool_result") msgs.push({ role: "tool", tool_call_id: b.tool_use_id, content: typeof b.content === "string" ? b.content : JSON.stringify(b.content) });
      }
      const text = blocks.filter(b => b.type === "text").map(b => b.text).join("\n");
      if (text) msgs.push({ role: "user", content: text });
    }
  }
  const body = { model, messages: msgs, max_tokens: Math.min(params.max_tokens || 2048, 8192) };
  if (params.tools?.length) {
    body.tools = params.tools.map(t => ({ type: "function", function: { name: t.name, description: t.description || "", parameters: t.input_schema } }));
    body.tool_choice = "auto";
  }
  const fmt = params.output_config?.format;
  if (fmt?.type === "json_schema") body.response_format = { type: "json_schema", json_schema: { name: "output", schema: fmt.schema, strict: true } };
  return body;
}

function fromOpenAI(choice) {
  const msg = choice?.message || {};
  const content = [];
  if (msg.content) content.push({ type: "text", text: msg.content });
  for (const c of msg.tool_calls || []) {
    let input = {};
    try { input = JSON.parse(c.function?.arguments || "{}"); } catch {}
    content.push({ type: "tool_use", id: c.id || "call_" + Math.random().toString(36).slice(2), name: c.function?.name, input });
  }
  const fr = choice?.finish_reason;
  const stop_reason = content.some(b => b.type === "tool_use") ? "tool_use" : fr === "length" ? "max_tokens" : fr === "content_filter" ? "refusal" : "end_turn";
  return { stop_reason, content };
}

export class AIError extends Error { constructor(status, message) { super(message); this.status = status; this.name = "AIError"; } }

export function compatClient({ baseURL, apiKey, model, fetchImpl = (...a) => fetch(...a) }) {
  async function call(params, { signal } = {}, stream = false) {
    const body = toOpenAI(params, model);
    if (stream) body.stream = true;
    const send = b => fetchImpl(`${baseURL}/chat/completions`, { method: "POST", signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(b) });
    let r = await send(body);
    // Some models don't accept strict JSON schemas: retry asking for plain JSON with the schema in the prompt.
    if (r.status === 400 && body.response_format?.type === "json_schema") {
      const schema = JSON.stringify(body.response_format.json_schema.schema);
      body.response_format = { type: "json_object" };
      body.messages = [{ role: "system", content: `Reply with ONLY a JSON object matching this JSON Schema:\n${schema}` }, ...body.messages];
      r = await send(body);
    }
    if (!r.ok) throw new AIError(r.status, `AI provider error ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r;
  }

  const create = async (params, opts) => fromOpenAI((await (await call(params, opts)).json()).choices?.[0]);

  function streamFn(params, opts = {}) {
    let finalResolve, finalReject;
    const final = new Promise((res, rej) => { finalResolve = res; finalReject = rej; });
    final.catch(() => {});
    return {
      async *[Symbol.asyncIterator]() {
        let text = "", finish = null;
        const calls = [];
        try {
          const r = await call(params, opts, true);
          const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "";
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let i;
            while ((i = buf.indexOf("\n")) >= 0) {
              const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (data === "[DONE]") continue;
              let j; try { j = JSON.parse(data); } catch { continue; }
              const ch = j.choices?.[0]; if (!ch) continue;
              if (ch.delta?.content) { text += ch.delta.content; yield { type: "content_block_delta", delta: { type: "text_delta", text: ch.delta.content } }; }
              for (const tc of ch.delta?.tool_calls || []) {
                const k = tc.index ?? calls.length;
                calls[k] ??= { id: tc.id, function: { name: "", arguments: "" } };
                if (tc.id) calls[k].id = tc.id;
                if (tc.function?.name) calls[k].function.name += tc.function.name;
                if (tc.function?.arguments) calls[k].function.arguments += tc.function.arguments;
              }
              if (ch.finish_reason) finish = ch.finish_reason;
            }
          }
          finalResolve(fromOpenAI({ message: { content: text, tool_calls: calls.filter(Boolean) }, finish_reason: finish }));
        } catch (e) { finalReject(e); throw e; }
      },
      finalMessage: () => final,
    };
  }

  const messages = { create, stream: streamFn };
  return { messages, beta: { messages } };
}
