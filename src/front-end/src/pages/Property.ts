import { Page } from '../ui/Page'
import { h, button } from '../ui/dom'
import { buildScreen, asset } from '../ui/screen'
import { $ui, core, UI } from '../globals'
import { $lang, type LangKey } from '../i18n'
import { $$event } from '../core/eventBus'
import { clamp } from '../core/utils'
import type { PropertyAllocate, TalentInfo } from '../core/types'

type PKey = keyof PropertyAllocate
const KEYS: PKey[] = ['CHR', 'INT', 'STR', 'MNY']
const LABEL: Record<PKey, LangKey> = { CHR: 'prop_charm', INT: 'prop_int', STR: 'prop_str', MNY: 'prop_money' }

export class PropertyPage extends Page {
  readonly name = UI.pages.PROPERTY

  private talents: TalentInfo[] = []
  private allocation: PropertyAllocate = { CHR: 0, INT: 0, STR: 0, MNY: 0 }
  private totalPoints = 20
  private spendable = 20
  private overflow = 0
  private sprInit = 0
  private talentLuck = 0
  private limit: [number, number] = [0, 10]
  private labLeft!: HTMLElement
  private valEls = new Map<PKey, HTMLElement>()
  private helpEl: HTMLElement | null = null

  override init(args: { talents: TalentInfo[] }): void {
    this.talents = args.talents ?? []

    const replacements = core.remake(this.talents.map((t) => t.id))
    replacements.forEach((r) => {
      const from = this.talents.find((t) => t.id === r.from)?.name ?? r.from
      $$event('message', ['msg_replacement', from, r.to])
    })

    const info = core.allocInfo()
    this.totalPoints = info.total
    this.spendable = info.spendable
    this.overflow = info.overflow
    this.sprInit = info.sprInit
    this.talentLuck = info.talentLuck
    this.limit = info.limits
    this.allocation = { CHR: 0, INT: 0, STR: 0, MNY: 0 }

    const safe = buildScreen(this.root, { decoBars: true, hud: true, gif: true, bg: 'attr-bg.svg' })
    safe.append(
      button($lang.back, () => $ui.switchView(UI.pages.TALENT), 'btn--thin btn-back'),
      h('div', { class: 'screen-title txt', text: `- ${$lang.prop_title} -`, style: { top: '161px' } }),
    )

    const panel = h('div', { class: 'attr-panel' })
    panel.appendChild(h('img', { class: 'frame-bg', attrs: { src: asset('attr-panel.svg'), alt: '' } }))
    const rows = h('div', { class: 'attr-rows' })
    KEYS.forEach((k) => rows.appendChild(this.buildRow(k)))
    panel.appendChild(rows)
    this.labLeft = h('span', { class: 'attr-left' })
    panel.appendChild(
      h('div', { class: 'attr-foot' }, [
        this.labLeft,
        button($lang.btn_random, () => this.random(), 'btn btn--thin', ),
      ]),
    )
    safe.appendChild(panel)

    const bonus = Math.max(0, this.totalPoints - 20)
    const help = button('?', () => this.toggleHelp(), 'btn--thin attr-help-btn')
    safe.appendChild(
      h('div', { class: 'attr-accum txt' }, [
        h('span', {
          text: $lang.t('accum_points', 20, bonus, this.totalPoints) + `　${$lang.prop_range}[${this.limit[0]}, ${this.limit[1]}]`,
        }),
        help,
      ]),
    )
    if (this.overflow > 0) {
      safe.appendChild(
        h('div', {
          class: 'attr-overflow txt',
          text: $lang.t('overflow_line', this.overflow, this.sprInit, this.talentLuck),
        }),
      )
    }

    safe.appendChild(h('div', { class: 'prop-talents-label txt', text: $lang.selected_talents }))
    const tbox = h('div', { class: 'prop-talents' })
    this.talents.forEach((t) => tbox.appendChild(h('div', { class: 'row-card', text: t.name })))
    safe.appendChild(tbox)

    const start = h('div', { class: 'start-life' }, [
      h('img', { class: 'start-icon', attrs: { src: asset('start-icon.svg'), alt: '' } }),
      h('span', { class: 'lbl', text: $lang.btn_start_life }),
    ])
    start.addEventListener('click', () => this.onStart())
    safe.appendChild(start)

    const randomBtn = panel.querySelector('.attr-foot .btn') as HTMLElement
    if (randomBtn) {
      randomBtn.style.width = '200px'
      randomBtn.style.height = '52px'
      randomBtn.style.fontSize = '26px'
    }

    this.updateUI()
  }

  private buildRow(k: PKey): HTMLElement {
    const val = h('span', { class: 'attr-input', text: '0' })
    this.valEls.set(k, val)
    const plus = h('img', {
      class: 'pm-icon',
      attrs: { src: asset('attr-plus.svg'), alt: '加' },
      onClick: () => this.setValue(k, this.allocation[k] + 1),
    })
    const minus = h('img', {
      class: 'pm-icon',
      attrs: { src: asset('attr-minus.svg'), alt: '减' },
      onClick: () => this.setValue(k, this.allocation[k] - 1),
    })
    return h('div', { class: 'attr-row' }, [
      h('span', { class: 'label', text: $lang.t(LABEL[k]) }),
      h('span', { class: 'attr-ctrl' }, [plus, val, minus]),
    ])
  }

  private remaining(): number {
    return this.spendable - KEYS.reduce((s, k) => s + this.allocation[k], 0)
  }

  private setValue(k: PKey, raw: number): void {
    let v = clamp(Math.floor(raw), this.limit[0], this.limit[1])
    const other = KEYS.filter((x) => x !== k).reduce((s, x) => s + this.allocation[x], 0)
    if (other + v > this.spendable) v = this.spendable - other
    v = clamp(v, this.limit[0], this.limit[1])
    this.allocation[k] = v
    this.updateUI()
  }

  private random(): void {
    const maxEach = this.limit[1]
    const arr = [maxEach, maxEach, maxEach, maxEach]
    let remaining = Math.min(this.spendable, maxEach * 4)
    let guard = 0
    while (remaining > 0 && guard++ < 1000) {
      const sub = Math.floor(Math.random() * Math.min(remaining, maxEach)) + 1
      const pick = Math.floor(Math.random() * 4)
      if (arr[pick] - sub < 0) continue
      arr[pick] -= sub
      remaining -= sub
    }
    KEYS.forEach((k, i) => (this.allocation[k] = clamp(maxEach - arr[i], this.limit[0], this.limit[1])))
    this.updateUI()
  }

  private updateUI(): void {
    this.labLeft.textContent = $lang.t('prop_left', this.remaining())
    KEYS.forEach((k) => {
      const el = this.valEls.get(k)
      if (el) el.textContent = String(this.allocation[k])
    })
  }

  private toggleHelp(): void {
    if (this.helpEl) {
      this.helpEl.remove()
      this.helpEl = null
      return
    }
    const sec = (t: string, b: string) =>
      h('div', { class: 'help-sec' }, [
        h('div', { class: 'help-h', text: t }),
        h('div', { class: 'help-b', text: b }),
      ])
    const box = h('div', { class: 'help-box scroll' }, [
      h('div', { class: 'help-title txt', text: $lang.help_title }),
      sec($lang.help_pts_t, $lang.help_pts_b),
      sec($lang.help_range_t, $lang.help_range_b),
      sec($lang.help_overflow_t, $lang.help_overflow_b),
      sec($lang.help_talent_t, $lang.help_talent_b),
      sec($lang.help_spr_t, $lang.help_spr_b),
      button($lang.help_close, () => this.toggleHelp(), 'btn help-close'),
    ])
    this.helpEl = h('div', { class: 'help-overlay' }, [box])
    this.root.appendChild(this.helpEl)
  }

  private onStart(): void {
    const allocation = this.allocation
    $ui.switchView(UI.pages.LOADING, {
      task: async () => {
        core.start(allocation)
        await core.precompute()
      },
      next: UI.pages.TRAJECTORY,
      nextArgs: { propertyAllocate: allocation, talents: this.talents, enableExtend: true },
      minMs: 900,
    })
  }
}
