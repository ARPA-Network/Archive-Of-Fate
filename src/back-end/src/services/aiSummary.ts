import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config'
import type { FateSummaryData } from '../types'
import { fallbackSummary } from './aiService'

function isEn(lang?: string): boolean {
  return (lang ?? '').toLowerCase().startsWith('en')
}

function buildPrompt(fate: FateSummaryData, eventLog: string[], lang?: string): string {
  const recent = eventLog.slice(-8).join(isEn(lang) ? ' ' : '；')
  if (isEn(lang)) {
    return [
      'You are a fate narrator. Write EXACTLY ONE short sentence summarizing this life, in natural English — 20 words or fewer.',
      'Output a single complete sentence ending with a period. No second sentence. No line breaks. Be concise.',
      `Character: ${fate.characterName}, lived to ${fate.HAGE}, fate level ${fate.fateLevel}, overall score ${fate.sum}, ${fate.mythEventCount} mythic moments.`,
      recent ? `Life moments: ${recent}` : '',
      'Output only the summary text — no title, quotes, or preamble.',
    ].filter(Boolean).join('\n')
  }
  return [
    '你是命运叙事者。请用通顺、自然、略带文学气息的现代中文，为下面这一生写 1~2 句话的人生总结，40~55 字。',
    '务必是完整的句子，把话说完整，结尾用句号；不要半句戛然而止，不要堆砌生僻文言。',
    `角色：${fate.characterName}，享年 ${fate.HAGE}，命运等级 ${fate.fateLevel}，综评 ${fate.sum}，神话时刻 ${fate.mythEventCount} 次。`,
    recent ? `人生片段：${recent}` : '',
    '只输出总结正文，不要标题、引号或解释。',
  ].filter(Boolean).join('\n')
}

function firstSentence(text: string): string {
  const t = text.trim().replace(/^["'“「]+|["'”」]+$/g, '').trim()
  const m = t.match(/^[\s\S]*?[.!?]/)
  return m ? m[0].trim() : t
}

function trimToCompleteSentence(text: string, en: boolean): string {
  const t = text.trim().replace(/^["'“「]+|["'”」]+$/g, '').trim()
  const enders = en ? ['.', '!', '?'] : ['。', '！', '？', '…', '”', '」']
  if (t.length === 0) return t
  if (enders.includes(t[t.length - 1])) return t
  let idx = -1
  for (const e of enders) idx = Math.max(idx, t.lastIndexOf(e))
  return idx > 0 ? t.slice(0, idx + 1) : t
}

let _client: Anthropic | null = null
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: config.ai.apiKey ?? undefined, timeout: config.ai.timeoutMs })
  return _client
}

export async function generateLifeSummaryAI(
  fate: FateSummaryData,
  eventLog: string[],
  lang?: string,
): Promise<string> {
  if (!config.ai.apiKey) {
    console.log('[ai] ANTHROPIC_API_KEY not configured -> life_summary using rule-based fallback')
    return fallbackSummary(fate, lang)
  }
  const en = isEn(lang)
  const t0 = Date.now()
  try {
    console.log(`[ai] -> Claude request model=${config.ai.model}`)
    const msg = await client().messages.create({
      model: config.ai.model,
      max_tokens: en ? 80 : 220,
      temperature: 0.8,
      messages: [{ role: 'user', content: buildPrompt(fate, eventLog, lang) }],
    })
    const block = msg.content.find((b) => b.type === 'text')
    const raw = block && block.type === 'text' ? block.text.trim() : ''
    if (raw.length > 0) {
      const text = en ? firstSentence(raw) : trimToCompleteSentence(raw, false)
      if (msg.stop_reason === 'max_tokens') {
        console.warn('[ai] Claude output truncated by max_tokens, trimmed back to a complete sentence')
      }
      console.log(`[ai] Claude returned ${text.length} chars in ${Date.now() - t0}ms`)
      return text
    }
    console.warn('[ai] Claude returned empty response -> fallback')
    return fallbackSummary(fate, lang)
  } catch (e) {
    console.warn(`[ai] Claude call failed -> fallback: ${(e as Error).message}`)
    return fallbackSummary(fate, lang)
  }
}
