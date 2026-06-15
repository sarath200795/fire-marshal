// Vercel Serverless Function — AI fallback for the Fire Marshal Safety Bot ("Sam").
// The API key stays server-side (set GEMINI_API_KEY in Vercel env, NOT a VITE_*
// var, so it is never shipped to the browser). The client posts a question + a
// compact, data-only snapshot of the org's extinguisher fleet; we ask the LLM to
// answer briefly using ONLY that data plus general fire-safety knowledge. If no
// key is configured or the upstream fails, we return a non-200 so the client
// cleanly falls back to its rule-based answer.
//
// Default provider: Google Gemini (free tier). To use OpenAI instead, set
// OPENAI_API_KEY and swap the call in `askOpenAI` below (template provided).

const GEMINI_MODEL = 'gemini-1.5-flash'

function systemPrompt(context) {
  return [
    'You are Sam, a friendly fire-safety assistant inside "Fire Marshal", a',
    'fire-extinguisher management app. Answer the user briefly and concretely',
    '(2–5 sentences, plain text, no markdown headings).',
    'Use ONLY the JSON data provided below for questions about the user\'s fleet —',
    'it is the live state of their organization. If the answer is not in the data,',
    'say so plainly and suggest what they could check. Never invent numbers or names.',
    'App workflow terms: an extinguisher flows To Be Refilled → (a vendor quotation',
    'is submitted) → Received by vendor → In Process → Refilled & Closed. Physical',
    'defects (PIN, stand, hose, handle) are resolved after a quotation. "HPT" is the',
    'periodic Hydrostatic Pressure Test; each unit tracks Next-Refill and Next-HPT dates.',
    'The app ALSO tracks, per site: Safety Signage (Stretcher, Fire Order, Dug Out /',
    'Lift emergency contacts, FERP, MCP, FAS Panel, fire exit, assembly point, etc.,',
    'each with a condition; FERP records how many of the building\'s floors it covers)',
    'and Mock Drills (a scenario-based emergency drill with a checklist % score,',
    'outcome, teams, action log and CAPA; can be a real emergency). Use the data\'s',
    '"signage" and "mockDrills" objects for those questions.',
    'For GENERAL fire-safety questions (extinguisher types, fire classes, the PASS',
    'technique, service intervals) give a brief, practical, correct answer AND cite',
    'the UK HSE with the URL https://www.hse.gov.uk/. Extinguisher guidance: CO₂ or',
    'dry powder for electrical fires (never water/foam on live electrics); wet-chemical',
    'for cooking-oil (Class F); ABC dry powder covers solids, liquids and electrical.',
    '',
    'DATA (JSON):',
    JSON.stringify(context || {}),
  ].join('\n')
}

async function askGemini(key, question, context) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`
  const body = {
    system_instruction: { parts: [{ text: systemPrompt(context) }] },
    contents: [{ role: 'user', parts: [{ text: question }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
  }
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`gemini ${r.status}`)
  const d = await r.json()
  const text = d?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim()
  if (!text) throw new Error('gemini empty')
  return text
}

// Optional OpenAI alternative — uncomment + set OPENAI_API_KEY to use:
// async function askOpenAI(key, question, context) {
//   const r = await fetch('https://api.openai.com/v1/chat/completions', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
//     body: JSON.stringify({
//       model: 'gpt-4o-mini',
//       temperature: 0.3,
//       max_tokens: 400,
//       messages: [
//         { role: 'system', content: systemPrompt(context) },
//         { role: 'user', content: question },
//       ],
//     }),
//   })
//   if (!r.ok) throw new Error(`openai ${r.status}`)
//   const d = await r.json()
//   const text = d?.choices?.[0]?.message?.content?.trim()
//   if (!text) throw new Error('openai empty')
//   return text
// }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    res.status(501).json({ error: 'unconfigured' })
    return
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const question = String(payload.question || '').slice(0, 1000).trim()
    const context = payload.context || {}
    if (!question) {
      res.status(400).json({ error: 'no_question' })
      return
    }
    const answer = await askGemini(geminiKey, question, context)
    res.status(200).json({ answer })
  } catch (err) {
    res.status(502).json({ error: 'upstream_failed', detail: String(err?.message || err) })
  }
}
