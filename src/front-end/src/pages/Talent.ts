import { Page } from '../ui/Page'
import { h, button, clear } from '../ui/dom'
import { buildScreen } from '../ui/screen'
import { $ui, core, UI } from '../globals'
import { $lang, type LangKey } from '../i18n'
import { $$event } from '../core/eventBus'
import { GRADE_COLORS } from '../core/enums'
import type { TalentInfo } from '../core/types'

export class TalentPage extends Page {
  readonly name = UI.pages.TALENT

  private selected = new Set<number>()
  private talents: TalentInfo[] = []
  private listEl!: HTMLElement
  private btnNext!: HTMLButtonElement

  override init(): void {
    const safe = buildScreen(this.root, { decoBars: true, sideDeco: true, hud: true, gif: true, gifSrc: 'talent-spark.gif', bg: 'talent-bg.svg' })

    safe.append(
      button($lang.back, () => $ui.switchView(UI.pages.MAIN), 'btn--thin btn-back'),
      h('div', { class: 'world-tag txt', text: this.worldName() }),
      h('div', {
        class: 'screen-title txt',
        text: `- ${$lang.t('talent_choose', core.talentSelectLimit)} -`,
        style: { top: '160px' },
      }),
    )

    this.listEl = h('div', { class: 'list-area scroll' })
    safe.append(this.listEl)

    this.btnNext = button($lang.select_incomplete, () => this.onNext(), 'btn footer-btn disabled')
    safe.append(this.btnNext)

    this.draw()
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

  private draw(): void {
    this.talents = core.talentRandom()
    this.selected.clear()
    this.talents.forEach((t, i) => {
      if (t.inherited) this.selected.add(i)
    })
    this.render()
    this.updateNext()
  }

  private render(): void {
    clear(this.listEl)
    this.talents.forEach((t, i) => {
      const children = [
        h('div', { class: 'row-name', text: t.name, style: { color: GRADE_COLORS[t.grade] } }),
        h('div', { class: 'row-desc', text: t.description }),
      ]
      const eff = this.formatEffect(t)
      if (eff) children.push(h('div', { class: 'row-effect', text: eff }))
      const card = h('div', { class: 'row-card' }, children)
      if (this.selected.has(i)) card.classList.add('sel')
      if (t.inherited) card.classList.add('locked', 'sel')
      card.addEventListener('click', () => this.onCardClick(i, card))
      this.listEl.appendChild(card)
    })
  }

  private formatEffect(t: TalentInfo): string {
    const NAME_KEY: Record<string, LangKey> = {
      CHR: 'prop_charm',
      INT: 'prop_int',
      STR: 'prop_str',
      MNY: 'prop_money',
      SPR: 'prop_spirit',
      RDM: 'prop_random',
    }
    const parts: string[] = []
    for (const [k, v] of Object.entries(t.effect ?? {})) {
      if (!v) continue
      if (k === 'LIF') continue 
      const key = NAME_KEY[k]
      const name = key ? $lang.t(key) : k
      parts.push(`${name} ${v >= 0 ? '+' : ''}${v}`)
    }
    if (t.status) parts.push(`${$lang.t('prop_points')} ${t.status >= 0 ? '+' : ''}${t.status}`)
    return parts.join('   ')
  }

  private onCardClick(index: number, card: HTMLElement): void {
    if (this.talents[index].inherited) return
    if (this.selected.has(index)) {
      this.selected.delete(index)
      card.classList.remove('sel')
    } else {
      if (this.selected.size >= core.talentSelectLimit) {
        $$event('message', ['msg_select_limit'])
        return
      }
      const ids = [...this.selected].map((i) => this.talents[i].id)
      const conflict = core.exclude(ids, this.talents[index].id)
      if (conflict != null) {
        const name = this.talents.find((x) => x.id === conflict)?.name ?? conflict
        $$event('message', ['msg_talent_conflict', name])
        return
      }
      this.selected.add(index)
      card.classList.add('sel')
    }
    this.updateNext()
  }

  private updateNext(): void {
    const done = this.selected.size === core.talentSelectLimit
    this.btnNext.textContent = done ? $lang.select_done : $lang.select_incomplete
    this.btnNext.classList.toggle('disabled', !done)
  }

  private async onNext(): Promise<void> {
    if (this.selected.size < core.talentSelectLimit) {
      $$event('message', ['msg_select_full'])
      return
    }
    const talents = [...this.selected].map((i) => this.talents[i])
    this.btnNext.classList.add('disabled')
    await core.selectTalents(talents.map((t) => t.id))
    $ui.switchView(UI.pages.PROPERTY, { talents, enableExtend: true })
  }
}
