import { Page } from '../ui/Page'
import { h, button } from '../ui/dom'
import { buildScreen } from '../ui/screen'
import { $ui, UI } from '../globals'
import { $lang, isEn } from '../i18n'
import { GRADE_COLORS } from '../core/enums'
import { progression } from '../core/progression'
import { ACHIEVEMENTS, type MockAchievement } from '../core/mock/data/worlds'

interface AchvView extends MockAchievement {
  unlocked: boolean
  unlockedAt: number
}

export class AchievementPage extends Page {
  readonly name = UI.pages.ACHIEVEMENT

  override init(): void {
    const unlocked = new Map(progression.achievements())
    const views: AchvView[] = ACHIEVEMENTS.map((a) => ({
      ...a,
      unlocked: unlocked.has(a.id),
      unlockedAt: unlocked.get(a.id) ?? 0,
    }))
    views.sort((a, b) => {
      if (a.unlocked && b.unlocked) return b.unlockedAt - a.unlockedAt
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1
      const ah = a.hide ? 1 : 0
      const bh = b.hide ? 1 : 0
      if (ah !== bh) return ah - bh
      return b.grade - a.grade
    })

    const safe = buildScreen(this.root, { decoBars: true })
    safe.append(
      button($lang.back, () => $ui.switchView(UI.pages.MAIN), 'btn--thin btn-back'),
      h('div', { class: 'screen-title txt', text: $lang.achv_title, style: { top: '90px' } }),
    )

    const list = h('div', { class: 'achv-list scroll' })
    views.forEach((v) => list.appendChild(this.card(v)))
    safe.appendChild(list)
  }

  private card(v: AchvView): HTMLElement {
    const hidden = $lang.achv_hidden
    const en = isEn()
    const vName = en ? v.nameEn : v.name
    const vDesc = en ? v.descEn : v.description
    const name = v.unlocked ? vName : v.hide ? hidden : vName
    const desc = v.unlocked ? vDesc : hidden
    const card = h('div', { class: 'achv-card' }, [
      h('div', { class: 'achv-name', text: name, style: { color: v.unlocked ? GRADE_COLORS[v.grade] : '#888888' } }),
      h('div', { class: 'achv-desc', text: desc }),
    ])
    if (!v.unlocked) card.classList.add('locked')
    return card
  }
}
