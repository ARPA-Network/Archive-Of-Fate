import { Page } from '../ui/Page'
import { h, button } from '../ui/dom'
import { buildScreen } from '../ui/screen'
import { $ui, core, UI } from '../globals'
import { $lang } from '../i18n'
import { LEVEL_COLORS } from '../core/enums'
import type { InscriptionEntry } from '../core/types'

export class MythAtlasPage extends Page {
  readonly name = UI.pages.MYTH_ATLAS

  override async init(): Promise<void> {
    await core.refreshShared().catch(() => {})
    const records = core.mythRegistry.list
    const safe = buildScreen(this.root, { decoBars: true })

    safe.append(
      button($lang.back, () => $ui.switchView(UI.pages.MAIN), 'btn--thin btn-back'),
      h('div', { class: 'screen-title txt', text: $lang.atlas_title, style: { top: '90px' } }),
      h('div', { class: 'board-head' }, [
        h('div', {
          class: 'board-count',
          text: records.length ? $lang.t('atlas_count', records.length) : $lang.atlas_empty,
        }),
      ]),
    )

    const list = h('div', { class: 'record-list scroll' })
    if (!records.length) list.appendChild(h('div', { class: 'empty-tip', text: $lang.atlas_empty }))
    else [...records].reverse().forEach((r) => list.appendChild(this.card(r)))
    safe.appendChild(list)
  }

  private card(r: InscriptionEntry): HTMLElement {
    const color = LEVEL_COLORS[r.fateLevel] || '#cccccc'
    const title = r.characterName ? `${r.characterName} · ${r.title}` : r.title
    return h('div', { class: 'record-card' }, [
      h('div', { class: 'record-title', text: title, style: { color } }),
      h('div', {
        class: 'record-sub',
        text: $lang.t('record_level_line', r.fateLevel, r.HAGE, r.world || '现实'),
        style: { color },
      }),
      h('div', { class: 'record-info', text: Array.isArray(r.traits) ? r.traits.join(' · ') : '' }),
    ])
  }
}
