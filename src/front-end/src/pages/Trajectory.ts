import { Page } from '../ui/Page'
import { h, button, clear } from '../ui/dom'
import { buildScreen, asset } from '../ui/screen'
import { $ui, core, UI } from '../globals'
import { $lang, type LangKey } from '../i18n'
import { $$on } from '../core/eventBus'
import { Events, GRADE_COLORS } from '../core/enums'
import type { ContentItem, PropertyAllocate, PropertySnapshot, TalentInfo, TurnResult } from '../core/types'

type SpeedMode = 'manual' | 'slow' | 'fast'
const SPEED_INTERVAL: Record<SpeedMode, number> = { manual: 0, slow: 1600, fast: 450 }

export class TrajectoryPage extends Page {
  readonly name = UI.pages.TRAJECTORY

  private talents: TalentInfo[] = []
  private enableExtend = true
  private isReplay = false
  private isEnd = false
  private autoTimer: number | null = null
  private speed: SpeedMode = 'manual'

  private panel!: HTMLElement
  private vbox!: HTMLElement
  private timeCtrl!: HTMLElement
  private summaryBtn!: HTMLButtonElement
  private statEls = new Map<string, HTMLElement>()
  private speedBtns = new Map<SpeedMode, HTMLButtonElement>()
  private mythItemMap = new Map<string, HTMLElement>()

  constructor() {
    super()
  }

  override init(args: {
    propertyAllocate: PropertyAllocate
    talents: TalentInfo[]
    enableExtend?: boolean
    isReplay?: boolean
  }): void {
    this.talents = args.talents ?? []
    this.enableExtend = args.enableExtend ?? true
    this.isReplay = args.isReplay ?? false

    const safe = buildScreen(this.root, { decoBars: true, hud: true, gif: true })
    this.build(safe)

    this.onDispose(
      $$on(Events.MYTH_TEXT_UPDATE, ({ id, text }: { id: string; text: string }) => {
        const item = this.mythItemMap.get(id)
        if (item) {
          item.textContent = $lang.myth_prefix + text
          this.mythItemMap.delete(id)
        }
      }),
    )

    const a = args.propertyAllocate
    this.updateProperties({ CHR: a.CHR, INT: a.INT, STR: a.STR, MNY: a.MNY, SPR: 5 })
    this.showSeed(core.fateSummary.seed)
    this.onNext() 
  }

  private build(safe: HTMLElement): void {
    safe.appendChild(h('div', { class: 'world-tag txt', text: this.worldName() }))

    const bar = h('div', { class: 'attr-bar' })
    bar.appendChild(h('img', { class: 'attrbar-bg', attrs: { src: asset('traj-attrbar-bg.svg'), alt: '' } }))
    const stats: Array<[string, LangKey]> = [
      ['CHR', 'prop_charm'],
      ['INT', 'prop_int'],
      ['STR', 'prop_str'],
      ['MNY', 'prop_money'],
      ['SPR', 'prop_spirit'],
    ]
    stats.forEach(([key, label]) => {
      const val = h('span', { class: 'val', text: '0' })
      this.statEls.set(key, val)
      bar.appendChild(h('div', { class: 'attr-col' }, [h('span', { class: 'name', text: $lang.t(label) }), val]))
    })
    safe.appendChild(bar)

    const seed = h('div', { class: 'traj-seed txt' })
    this.statEls.set('SEED', seed)
    safe.appendChild(seed)

    this.vbox = h('div', { class: 'event-vbox' })
    this.panel = h('div', { class: 'panel-box event-panel scroll' }, [this.vbox])
    safe.appendChild(this.panel)

    this.timeCtrl = h('div', { class: 'time-ctrl' })
    this.timeCtrl.appendChild(h('span', { class: 'lbl txt', text: $lang.speed_label + '：' }))
    const modes: Array<[SpeedMode, LangKey]> = [
      ['manual', 'speed_manual'],
      ['slow', 'speed_slow'],
      ['fast', 'speed_fast'],
    ]
    modes.forEach(([m, label]) => {
      const b = button($lang.t(label), () => this.setSpeed(m), 'speed-btn')
      if (m === 'manual') b.classList.add('active')
      this.speedBtns.set(m, b)
      this.timeCtrl.appendChild(b)
    })
    safe.appendChild(this.timeCtrl)

    this.summaryBtn = button(
      this.isReplay ? $lang.btn_back_to_board : $lang.btn_view_summary,
      () => (this.isReplay ? this.gotoBoard() : this.gotoSummary()),
      'btn traj-summary-btn',
    )
    this.summaryBtn.style.display = 'none'
    safe.appendChild(this.summaryBtn)

    let p1: { x: number; y: number } | null = null
    this.panel.addEventListener('pointerdown', (e) => (p1 = { x: e.clientX, y: e.clientY }))
    this.panel.addEventListener('pointerup', (e) => {
      if (!p1) return
      const dist = Math.abs(e.clientX - p1.x) + Math.abs(e.clientY - p1.y)
      p1 = null
      if (dist <= 10 && this.speed === 'manual') this.onNext()
    })
  }

  private worldName(): string {
    const map: Record<string, LangKey> = {
      'zh-cn': 'world_modern',
      'zh-cn-cf': 'world_xianxia',
      'zh-cn-wf': 'world_fantasy',
    }
    const key = map[core.worldFolder]
    return key ? $lang.t(key) : ''
  }

  private showSeed(seed: number): void {
    const el = this.statEls.get('SEED')
    if (el) el.textContent = $lang.t('traj_seed', seed)
  }

  private setSpeed(mode: SpeedMode): void {
    this.speed = mode
    this.speedBtns.forEach((b, m) => b.classList.toggle('active', m === mode))
    if (this.autoTimer != null) {
      window.clearInterval(this.autoTimer)
      this.autoTimer = null
    }
    const interval = SPEED_INTERVAL[mode]
    if (interval > 0) {
      this.autoTimer = window.setInterval(() => this.onNext(), interval)
      this.onDispose(() => {
        if (this.autoTimer != null) window.clearInterval(this.autoTimer)
      })
    }
  }

  private onNext(): void {
    if (this.isEnd) return
    const result: TurnResult = core.next()
    this.isEnd = result.isEnd
    if (result.content.length) this.renderItem(result.age, result.content)
    this.updateProperties(result.propertySnapshot)

    if (this.isEnd) {
      if (this.autoTimer != null) {
        window.clearInterval(this.autoTimer)
        this.autoTimer = null
      }
      this.timeCtrl.style.display = 'none'
      this.summaryBtn.style.display = 'flex'
      this.frameOnce(() => (this.panel.scrollTop = this.panel.scrollHeight))
    }
  }

  private renderItem(age: number, content: ContentItem[]): void {
    const lines: string[] = []
    const lastGrade = content[content.length - 1]?.grade ?? 0
    let isMyth = false
    let mythId: string | undefined

    for (const c of content) {
      if (c.type === 'TLT') lines.push($lang.t('talent_trigger', c.name ?? '', c.description))
      else if (c.type === 'EVT') lines.push(c.description + (c.postEvent ? '\n' + c.postEvent : ''))
      else if (c.type === 'myth_event') {
        lines.push($lang.myth_prefix + c.description)
        isMyth = true
        mythId = c.instanceId
      }
    }

    const desc = h('div', { class: 'desc' + (isMyth ? ' myth' : '') })
    desc.textContent = lines.filter(Boolean).join('\n')

    const row = h('div', { class: 'event-row', style: { borderLeftColor: GRADE_COLORS[lastGrade] } }, [
      h('span', { class: 'age', text: $lang.t('traj_age', age) }),
      desc,
    ])
    if (isMyth && mythId) this.mythItemMap.set(mythId, desc)

    this.vbox.appendChild(row)
    this.frameOnce(() => (this.panel.scrollTop = this.panel.scrollHeight))
  }

  private updateProperties(snap: PropertySnapshot): void {
    ;(['CHR', 'INT', 'STR', 'MNY', 'SPR'] as const).forEach((k) => {
      const el = this.statEls.get(k)
      if (el) el.textContent = String((snap as unknown as Record<string, number>)[k] ?? 0)
    })
  }

  private gotoSummary(): void {
    $ui.switchView(UI.pages.SUMMARY, { talents: this.talents, enableExtend: this.enableExtend })
  }

  private gotoBoard(): void {
    $ui.switchView(UI.pages.WORLD_BOARD)
  }

  override close(): void {
    if (this.autoTimer != null) window.clearInterval(this.autoTimer)
    clear(this.vbox)
    super.close()
  }
}
