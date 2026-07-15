import { Page } from '../ui/Page'
import { h, button } from '../ui/dom'
import { buildScreen, asset } from '../ui/screen'
import { $ui, core, UI } from '../globals'
import { $lang } from '../i18n'
import { $$event } from '../core/eventBus'
import { progression } from '../core/progression'
import { ACHIEVEMENTS } from '../core/mock/data/worlds'
import { downloadCard } from '../ui/shareCard'
import { buildRadar } from '../ui/radar'
import type { Summary, TalentInfo } from '../core/types'

export class SummaryPage extends Page {
  readonly name = UI.pages.SUMMARY

  private talents: TalentInfo[] = []
  private enableExtend = true
  private selectedTalent: number | null = null
  private summary!: Summary
  private inscribed = false
  private btnInscribe!: HTMLButtonElement

  override init(args: { talents: TalentInfo[]; enableExtend?: boolean }): void {
    this.talents = args.talents ?? []
    this.enableExtend = args.enableExtend ?? true
    this.selectedTalent = core.lastExtendTalent
    this.summary = core.summary
    const s = this.summary

    const safe = buildScreen(this.root, { decoBars: true, hud: true, gif: true, bg: 'summary-bg.svg' })

    safe.append(h('div', { class: 'sm-title txt', text: $lang.summary_title }))

    const radar = buildRadar({
      size: 340,
      stats: [
        { label: $lang.prop_charm, value: s.HCHR },
        { label: $lang.prop_int, value: s.HINT },
        { label: $lang.prop_str, value: s.HSTR },
        { label: $lang.prop_money, value: s.HMNY },
        { label: $lang.prop_spirit, value: s.HSPR },
      ],
      centerTopLabel: $lang.prop_sum,
      centerTopValue: s.sum,
      centerBottomLabel: $lang.prop_age,
      centerBottomValue: s.HAGE,
    })
    safe.appendChild(h('div', { class: 'sm-radar' }, [radar]))

    const summaryBox = h('div', { class: 'sm-summary panel-box scroll txt', text: $lang.fate_generating })
    safe.appendChild(summaryBox)
    core.getLifeSummary().then((text) => {
      summaryBox.textContent = text || ''
    })

    this.btnInscribe = button('', () => this.onInscribe(), 'btn sm-inscribe')
    this.btnInscribe.append(
      h('img', { attrs: { src: asset('wallet-icon.svg'), alt: '' } }),
      document.createTextNode($lang.btn_inscribe),
    )
    const help = h('button', {
      class: 'sm-help',
      text: '?',
      onClick: () => $$event('message', ['summary_inscribe_note']),
    })
    safe.append(
      this.btnInscribe,
      help,
      button($lang.btn_share_card, () => this.onShare(), 'btn sm-share'),
    )

    if (this.enableExtend) {
      safe.appendChild(h('div', { class: 'sm-extend-tip txt', text: $lang.summary_inherit_tip }))
    }
    const tbox = h('div', { class: 'sm-talents' })
    this.talents.forEach((t) => {
      const card = h('div', { class: 'row-card', text: t.name })
      if (t.id === this.selectedTalent) card.classList.add('sel')
      if (this.enableExtend) {
        card.addEventListener('click', () => {
          this.selectedTalent = this.selectedTalent === t.id ? null : t.id
          ;[...tbox.children].forEach((c, i) =>
            (c as HTMLElement).classList.toggle('sel', this.talents[i].id === this.selectedTalent),
          )
        })
      }
      tbox.appendChild(card)
    })
    safe.appendChild(tbox)

    safe.append(
      button($lang.btn_restart, () => this.onAgain(), 'btn sm-again'),
      button($lang.btn_main_menu, () => this.onMenu(), 'btn sm-menu'),
    )
  }

  private async onInscribe(): Promise<void> {
    if (this.inscribed) return
    this.inscribed = true
    this.btnInscribe.classList.add('disabled')
    this.btnInscribe.textContent = $lang.btn_inscribing
    try {
      await core.inscribeFate()
      this.btnInscribe.textContent = $lang.btn_inscribed
      $$event('message', ['msg_inscribe_success'])
      this.checkAchievements()
    } catch {
      this.inscribed = false
      this.btnInscribe.classList.remove('disabled')
      this.btnInscribe.textContent = ''
      this.btnInscribe.append(
        h('img', { attrs: { src: asset('wallet-icon.svg'), alt: '' } }),
        document.createTextNode($lang.btn_inscribe),
      )
      $$event('message', ['msg_inscribe_fail'])
    }
  }

  private onShare(): void {
    const fate = core.fateSummary
    const title = core.fateTitle
    const traits = core.fateTraits
    core.getLifeSummary().then((text) => {
      downloadCard({ fate, title, traits, summary: text || title })
      $$event('message', ['msg_card_saved'])
    })
  }

  private commitExtend(): void {
    core.talentExtend(this.selectedTalent)
    core.times = core.times + 1
  }

  private onAgain(): void {
    this.commitExtend()
    $ui.switchView(UI.pages.LOADING, {
      task: async () => {
        await core.prepareLife()
      },
      next: UI.pages.TALENT,
      minMs: 700,
    })
  }

  private onMenu(): void {
    this.commitExtend()
    $ui.switchView(UI.pages.MAIN)
  }

  private checkAchievements(): void {
    const s = this.summary
    const now = Date.now()
    for (const a of ACHIEVEMENTS) {
      if (a.check({ sum: s.sum, mythCount: s.mythCount, fateLevel: s.fateLevel, HAGE: s.HAGE })) {
        if (progression.unlockAchievement(a.id, now)) {
          $$event('achievement', { name: a.name, grade: a.grade })
        }
      }
    }
  }
}
