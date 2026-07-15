import fs from 'fs'
import path from 'path'

function load(file: string): void {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf-8').split(/\r?\n/)) {
    const l = line.trim()
    if (!l || l.startsWith('#') || !l.includes('=')) continue
    const i = l.indexOf('=')
    const k = l.slice(0, i).trim()
    let v = l.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    if (process.env[k] === undefined) process.env[k] = v
  }
}

load(path.resolve(__dirname, '..', '.env'))
