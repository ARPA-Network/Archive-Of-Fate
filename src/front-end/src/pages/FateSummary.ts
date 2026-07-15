import { Page } from '../ui/Page'
import { h, button, setText } from '../ui/dom'
import { buildScreen, asset } from '../ui/screen'
import { $ui, core, UI } from '../globals'
import { $lang, isEn } from '../i18n'
import { $$event } from '../core/eventBus'
import { LEVEL_COLORS } from '../core/enums'
import { downloadCard } from '../ui/shareCard'
import { progression } from '../core/progression'
import { ACHIEVEMENTS } from '../core/mock/data/worlds'
import type { FateSummary } from '../core/types'

export class FateSummaryPage extends Page {
  readonly name = UI.pages.FATE_SUMMARY

  private fate!: FateSummary
  private selectedTalent: number | null = null
  private inscribed = false
  private title = ''
  private traits: string[] = []
  private summaryText = ''
  private btnInscribe!: HTMLButtonElement
  private labSummary!: HTMLElement

  override init(args: {
    fateSummary: FateSummary
    selectedTalent?: number | null
  }): void {
    this.fate = args.fateSummary
    this.selectedTalent = args.selectedTalent ?? null
    const f = this.fate
    const color = LEVEL_COLORS[f.fateLevel] || '#ffffff'
    this.title = core.fateTitle
    this.traits = core.fateTraits

    const safe = buildScreen(this.root, { decoBars: true, hud: true })

    const name = f.characterName ? `${f.characterName} · ${this.title}` : this.title
    const metaLines = [$lang.t('fate_seed', f.seed)]
    if (f.mythEventCount > 0) metaLines.push($lang.t('fate_myth', f.mythEventCount))

    this.labSummary = h('div', { class: 'fate-summary-box panel-box scroll txt', text: $lang.fate_generating })
    core.getLifeSummary().then((text) => {
      this.summaryText = text
      setText(this.labSummary, text)
    })

    this.btnInscribe = button('', () => this.onInscribe(), 'btn fate-inscribe')
    this.btnInscribe.append(
      h('img', { attrs: { src: asset('wallet-icon.svg'), alt: '' } }),
      document.createTextNode($lang.btn_inscribe),
    )

    safe.append(
      h('div', { class: 'fate-title txt', text: $lang.fate_title }),
      h('div', { class: 'fate-level', text: f.fateLevel || 'D', style: { color } }),
      h('div', { class: 'fate-level-label txt', text: $lang.fate_level_label }),
      h('div', { class: 'fate-name txt', text: name, style: { color } }),
      h('div', { class: 'fate-traits txt', text: this.traits.join(' · ') }),
      h('div', { class: 'fate-meta txt', text: metaLines.join('　') }),
      this.labSummary,
      h('div', { class: 'fate-actions' }, [
        this.btnInscribe,
        button($lang.btn_share_card, () => this.onShare(), 'btn fate-share'),
        button($lang.skip, () => this.onSkip(), 'btn--thin fate-skip'),
      ]),
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
      this.btnInscribe.textContent = $lang.btn_inscribe
      $$event('message', ['msg_inscribe_fail'])
    }
  }

  private onShare(): void {
    downloadCard({ fate: this.fate, title: this.title, traits: this.traits, summary: this.summaryText || this.title })
    $$event('message', ['msg_card_saved'])
  }

  private onSkip(): void {
    core.talentExtend(this.selectedTalent)
    core.times = core.times + 1
    $ui.switchView(UI.pages.MAIN)
  }

  private checkAchievements(): void {
    const f = this.fate
    const now = Date.now()
    for (const a of ACHIEVEMENTS) {
      if (a.check({ sum: f.sum, mythCount: f.mythEventCount, fateLevel: f.fateLevel, HAGE: f.HAGE })) {
        if (progression.unlockAchievement(a.id, now)) {
          $$event('achievement', { name: isEn() ? a.nameEn : a.name, grade: a.grade })
        }
      }
    }
  }
}
