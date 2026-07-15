
export interface CondCtx {
  num(prop: string): number
  arr(prop: string): number[]
}

export type Cond = (ctx: CondCtx) => boolean

export interface ValidationResult {
  valid: boolean
  error?: string
}

const ALWAYS_TRUE: Cond = () => true

const ARRAY_PROPS = new Set(['TLT', 'EVT', 'ATLT', 'AEVT'])

export function compile(cond?: string | null): Cond {
  if (cond == null || !String(cond).trim()) return ALWAYS_TRUE
  const s = String(cond).trim()
  try {
    return isLegacy(s) ? compileLegacy(s) : compileSql(s)
  } catch (e) {
    console.warn(`[condition] compile failed, treating as always-true: "${s}" (${(e as Error).message})`)
    return ALWAYS_TRUE
  }
}

export function validate(cond?: string | null): ValidationResult {
  if (cond == null || !String(cond).trim()) return { valid: true }
  const s = String(cond).trim()
  try {
    if (isLegacy(s)) compileLegacy(s)
    else compileSql(s)
    return { valid: true }
  } catch (e) {
    return { valid: false, error: (e as Error).message }
  }
}

function isLegacy(s: string): boolean {
  if (/[?&|]/.test(s)) return true
  if (/![^=]/.test(s) || /!\s*$/.test(s)) return true
  return false
}

type Tok = { t: 'num'; v: number } | { t: 'op'; v: string } | { t: 'punc'; v: string } | { t: 'word'; v: string }

function tokenizeSql(s: string): Tok[] {
  const toks: Tok[] = []
  const re = /\s+|(>=|<=|!=|=|>|<)|([(),])|(-?\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)/g
  let m: RegExpExecArray | null
  let pos = 0
  while ((m = re.exec(s)) !== null) {
    if (m.index !== pos) throw new Error(`illegal character @${pos}: "${s.slice(pos, m.index)}"`)
    pos = re.lastIndex
    if (m[0].trim() === '') continue
    if (m[1]) toks.push({ t: 'op', v: m[1] })
    else if (m[2]) toks.push({ t: 'punc', v: m[2] })
    else if (m[3]) toks.push({ t: 'num', v: Number(m[3]) })
    else if (m[4]) toks.push({ t: 'word', v: m[4].toUpperCase() })
  }
  if (pos !== s.length) throw new Error(`illegal character @${pos}: "${s.slice(pos)}"`)
  return toks
}

function compileSql(s: string): Cond {
  const toks = tokenizeSql(s)
  let i = 0
  const peek = (): Tok | undefined => toks[i]
  const next = (): Tok => {
    const t = toks[i++]
    if (!t) throw new Error('unexpected end of condition')
    return t
  }
  const isWord = (w: string): boolean => {
    const t = peek()
    return !!t && t.t === 'word' && t.v === w
  }

  function parseOr(): Cond {
    let left = parseAnd()
    while (isWord('OR')) {
      next()
      const right = parseAnd()
      const l = left
      left = (c) => l(c) || right(c)
    }
    return left
  }

  function parseAnd(): Cond {
    let left = parsePrimary()
    while (isWord('AND')) {
      next()
      const right = parsePrimary()
      const l = left
      left = (c) => l(c) && right(c)
    }
    return left
  }

  function parsePrimary(): Cond {
    const t = peek()
    if (!t) throw new Error('unexpected end of condition')

    if (t.t === 'punc' && t.v === '(') {
      next()
      const inner = parseOr()
      const close = next()
      if (close.t !== 'punc' || close.v !== ')') throw new Error('missing closing parenthesis')
      return inner
    }

    if (t.t === 'num') {
      const n = (next() as { t: 'num'; v: number }).v
      let neg = false
      if (isWord('NOT')) {
        next()
        neg = true
      }
      if (!isWord('IN')) throw new Error('expected IN / NOT IN after number')
      next()
      const propT = next()
      if (propT.t !== 'word') throw new Error('expected a property name after IN')
      const prop = propT.v
      return (c) => {
        const has = c.arr(prop).includes(n)
        return neg ? !has : has
      }
    }

    if (t.t === 'word') {
      const prop = (next() as { t: 'word'; v: string }).v

      let neg = false
      if (isWord('NOT')) {
        next()
        neg = true
      }
      if (isWord('IN')) {
        next()
        const open = next()
        if (open.t !== 'punc' || open.v !== '(') throw new Error('expected ( after IN')
        const list: number[] = []
        for (;;) {
          const numT = next()
          if (numT.t !== 'num') throw new Error('IN list must contain numbers')
          list.push(numT.v)
          const sep = next()
          if (sep.t === 'punc' && sep.v === ')') break
          if (!(sep.t === 'punc' && sep.v === ',')) throw new Error('invalid IN list separator')
        }
        const isArr = ARRAY_PROPS.has(prop)
        return (c) => {
          const inList = isArr ? list.some((x) => c.arr(prop).includes(x)) : list.includes(c.num(prop))
          return neg ? !inList : inList
        }
      }
      if (neg) throw new Error('expected IN after NOT')

      const opT = next()
      if (opT.t !== 'op') throw new Error(`expected a comparison operator after property ${prop}`)
      const numT = next()
      if (numT.t !== 'num') throw new Error('expected a number after comparison operator')
      const op = opT.v
      const n = numT.v
      const isArr = ARRAY_PROPS.has(prop)
      return (c) => {
        if (op === '=') return isArr ? c.arr(prop).includes(n) : c.num(prop) === n
        if (op === '!=') return isArr ? !c.arr(prop).includes(n) : c.num(prop) !== n
        const v = c.num(prop)
        switch (op) {
          case '>': return v > n
          case '<': return v < n
          case '>=': return v >= n
          case '<=': return v <= n
          default: throw new Error(`unknown operator ${op}`)
        }
      }
    }

    throw new Error(`unparseable condition fragment: ${JSON.stringify(t)}`)
  }

  const ast = parseOr()
  if (i !== toks.length) throw new Error('trailing tokens after condition')
  return ast
}

function compileLegacy(s: string): Cond {
  let i = 0
  const src = s

  const skipWs = () => {
    while (i < src.length && /\s/.test(src[i])) i++
  }

  function parseExpr(): Cond {
    let left = parseTerm()
    for (;;) {
      skipWs()
      const ch = src[i]
      if (ch === '&' || ch === '|') {
        i++
        const right = parseTerm()
        const l = left
        left = ch === '&' ? (c) => l(c) && right(c) : (c) => l(c) || right(c)
      } else break
    }
    return left
  }

  function parseTerm(): Cond {
    skipWs()
    if (src[i] === '(') {
      i++
      const inner = parseExpr()
      skipWs()
      if (src[i] !== ')') throw new Error('legacy syntax: missing closing parenthesis')
      i++
      return inner
    }
    return parseAtom()
  }

  function readProp(): string {
    skipWs()
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))
    if (!m) throw new Error(`legacy syntax: expected a property name @${i}`)
    i += m[0].length
    return m[0].toUpperCase()
  }

  function readNumberList(): number[] {
    if (src[i] !== '[') throw new Error('legacy syntax: expected [')
    i++
    const list: number[] = []
    for (;;) {
      skipWs()
      const m = /^-?\d+(?:\.\d+)?/.exec(src.slice(i))
      if (!m) throw new Error('legacy syntax: expected a number in list')
      list.push(Number(m[0]))
      i += m[0].length
      skipWs()
      if (src[i] === ',') {
        i++
        continue
      }
      if (src[i] === ']') {
        i++
        break
      }
      throw new Error('legacy syntax: invalid list separator')
    }
    return list
  }

  function parseAtom(): Cond {
    const prop = readProp()
    skipWs()
    const ch = src[i]
    const isArr = ARRAY_PROPS.has(prop)

    if (ch === '?') {
      i++
      const list = readNumberList()
      return (c) => (isArr ? list.some((x) => c.arr(prop).includes(x)) : list.includes(c.num(prop)))
    }
    if (ch === '!' && src[i + 1] === '[') {
      i++
      const list = readNumberList()
      return (c) => (isArr ? !list.some((x) => c.arr(prop).includes(x)) : !list.includes(c.num(prop)))
    }

    const m = /^(>=|<=|!=|=|>|<)\s*(-?\d+(?:\.\d+)?)/.exec(src.slice(i))
    if (!m) throw new Error(`legacy syntax: unparseable @${i}: "${src.slice(i)}"`)
    i += m[0].length
    const op = m[1]
    const n = Number(m[2])
    return (c) => {
      if (op === '=') return isArr ? c.arr(prop).includes(n) : c.num(prop) === n
      if (op === '!=') return isArr ? !c.arr(prop).includes(n) : c.num(prop) !== n
      const v = c.num(prop)
      switch (op) {
        case '>': return v > n
        case '<': return v < n
        case '>=': return v >= n
        case '<=': return v <= n
        default: throw new Error(`unknown operator ${op}`)
      }
    }
  }

  const ast = parseExpr()
  skipWs()
  if (i !== src.length) throw new Error('legacy syntax: trailing characters')
  return ast
}
