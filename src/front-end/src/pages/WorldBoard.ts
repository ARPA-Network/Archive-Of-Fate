import { Page } from '../ui/Page'
import { h, button, clear } from '../ui/dom'
import { buildScreen } from '../ui/screen'
import { $ui, core, UI } from '../globals'
import { $lang, isEn, type LangKey } from '../i18n'
import { LEVEL_COLORS, WORLD_COLORS, worldDisplayName } from '../core/enums'
import { formatDate, shortAddress } from '../core/utils'
import { verifyInscription } from '../web3/chain'
import type { InscriptionEntry, PropertyAllocate, TalentInfo } from '../core/types'

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

type Mode = 'all' | 'mine' | 'stats'
type StatsState = 'idle' | 'loading' | 'error'

const STATS_WINDOWS: Array<{ key: string; label: LangKey }> = [
  { key: 'day', label: 'stats_dau' },
  { key: 'week', label: 'stats_wau' },
  { key: 'month', label: 'stats_mau' },
  { key: '3month', label: 'stats_3m' },
  { key: '6month', label: 'stats_6m' },
]

export class WorldBoardPage extends Page {
  readonly name = UI.pages.WORLD_BOARD

  private mode: Mode = 'all'
  private tabAll!: HTMLButtonElement
  private tabMine!: HTMLButtonElement
  private tabStats!: HTMLButtonElement
  private headEl!: HTMLElement
  private listEl!: HTMLElement

  private statsState: StatsState = 'idle'
  private stats: { totalUsers: number; activeUsers: Record<string, number> } | null = null

  override async init(): Promise<void> {
    await core.refreshShared().catch(() => {})
    const safe = buildScreen(this.root, { decoBars: true })

    this.tabAll = button($lang.tab_all, () => this.setMode('all'), 'board-tab')
    this.tabMine = button($lang.tab_mine, () => this.setMode('mine'), 'board-tab')
    this.tabStats = button($lang.tab_stats, () => this.setMode('stats'), 'board-tab')
    this.headEl = h('div', { class: 'board-head' })
    this.listEl = h('div', { class: 'record-list scroll' })

    safe.append(
      button($lang.back, () => $ui.switchView(UI.pages.MAIN), 'btn--thin btn-back'),
      h('div', { class: 'screen-title txt', text: $lang.btn_archive, style: { top: '90px' } }),
      h('div', { class: 'board-tabs' }, [this.tabAll, this.tabMine, this.tabStats]),
      this.headEl,
      this.listEl,
    )
    this.render()
  }

  private setMode(m: Mode): void {
    if (this.mode === m) return
    this.mode = m
    this.render()
    if (m === 'stats' && !this.stats && this.statsState !== 'loading') void this.loadStats()
  }

  private async loadStats(): Promise<void> {
    this.statsState = 'loading'
    this.render()
    try {
      const r = await core.fetchUserStats()
      this.stats = r
      this.statsState = 'idle'
    } catch (e) {
      console.error('[stats] load failed', e)
      this.statsState = 'error'
    }
    this.render()
  }

  private render(): void {
    this.tabAll.classList.toggle('active', this.mode === 'all')
    this.tabMine.classList.toggle('active', this.mode === 'mine')
    this.tabStats.classList.toggle('active', this.mode === 'stats')

    if (this.mode === 'stats') {
      this.renderStats()
      return
    }

    const records = this.mode === 'all' ? core.worldRegistry.list : core.mythRegistry.list

    clear(this.headEl)
    if (this.mode === 'all') {
      this.headEl.append(
        h('div', { class: 'board-count', text: $lang.t('board_count', records.length) }),
        h('div', { class: 'board-pollution', text: $lang.t('board_pollution', core.worldPollution.size) }),
      )
    } else {
      this.headEl.append(
        h('div', {
          class: 'board-count',
          text: records.length ? $lang.t('atlas_count', records.length) : $lang.atlas_empty,
        }),
      )
    }

    clear(this.listEl)
    if (!records.length) {
      this.listEl.appendChild(
        h('div', { class: 'empty-tip', text: this.mode === 'all' ? $lang.board_empty : $lang.atlas_empty }),
      )
    } else {
      ;[...records].reverse().forEach((r) => this.listEl.appendChild(this.card(r)))
    }
  }

  private renderStats(): void {
    clear(this.headEl)
    clear(this.listEl)

    if (this.statsState === 'loading') {
      this.listEl.appendChild(h('div', { class: 'empty-tip', text: $lang.stats_loading }))
      return
    }
    if (this.statsState === 'error' || !this.stats) {
      const retry = button($lang.stats_error, () => void this.loadStats(), 'btn--thin')
      this.listEl.appendChild(retry)
      return
    }

    this.headEl.append(
      h('div', { class: 'board-count', text: $lang.t('stats_total', this.stats.totalUsers) }),
    )
    const panel = h('div', { class: 'stats-panel' })
    for (const w of STATS_WINDOWS) {
      panel.appendChild(
        h('div', { class: 'stats-row', text: $lang.t(w.label, this.stats.activeUsers[w.key] ?? 0) }),
      )
    }
    this.listEl.appendChild(panel)
  }

  private card(r: InscriptionEntry): HTMLElement {
    const en = isEn()
    const worldColor = WORLD_COLORS[r.world] || '#888888'
    const levelColor = LEVEL_COLORS[r.fateLevel] || '#888888'
    const unnamed = $lang.board_unnamed
    const title = r.characterName ? `${r.characterName} · ${r.title || unnamed}` : r.title || unnamed
    const date = r.inscribedAt ? formatDate(r.inscribedAt, en ? 'en-US' : 'zh-CN') : ''
    const world = worldDisplayName(r.world || '', en)
    const children: HTMLElement[] = [
      h('div', { class: 'accent-bar', style: { background: worldColor } }),
      h('div', { class: 'record-title', text: title }),
      h('div', {
        class: 'record-sub',
        text: $lang.t('board_world_line', world, r.fateLevel),
        style: { color: levelColor },
      }),
      h('div', { class: 'record-info', text: $lang.t('board_info_line', r.HAGE, r.sum, date) }),
    ]
    if (r.ownerWallet) {
      children.push(h('div', { class: 'record-by', text: $lang.t('record_by', shortAddress(r.ownerWallet)) }))
    }
    const nft = r.nft
    if (nft && nft.contract && nft.contract.toLowerCase() !== ZERO_ADDR && nft.tokenId) {
      const vbtn = button($lang.btn_verify, () => this.runVerify(vbtn, r), 'btn--thin record-verify')
      const rbtn = button($lang.btn_replay, () => this.onReplay(r), 'btn--thin record-replay')
      const actions: HTMLElement[] = [rbtn, vbtn]
      const badge = this.auditBadge(r.verifyStatus)
      if (badge) actions.unshift(badge)
      children.push(h('div', { class: 'record-actions' }, actions))
    }
    return h('div', { class: 'record-card' }, children)
  }

  private onReplay(r: InscriptionEntry): void {
    const nextArgs: { propertyAllocate: PropertyAllocate; talents: TalentInfo[]; enableExtend: boolean; isReplay: boolean } = {
      propertyAllocate: r.allocation ?? { CHR: 0, INT: 0, STR: 0, MNY: 0 },
      talents: [],
      enableExtend: false,
      isReplay: true,
    }
    $ui.switchView(UI.pages.LOADING, {
      task: async () => {
        const res = await core.loadReplay(r)
        nextArgs.talents = res.talents
        nextArgs.propertyAllocate = res.allocation
      },
      next: UI.pages.TRAJECTORY,
      nextArgs,
      minMs: 900,
    })
  }

  private auditBadge(status: string | null | undefined): HTMLElement | null {
    if (!status) return null
    if (status === 'verified') {
      return h('span', { class: 'record-audit audit-ok', text: $lang.audit_verified, attrs: { title: $lang.audit_verified_tip } })
    }
    const reason = status.startsWith('mismatch:') ? status.slice('mismatch:'.length) : status
    return h('span', { class: 'record-audit audit-bad', text: $lang.audit_mismatch, attrs: { title: reason } })
  }

  private static readonly MIN_STEP_MS = 450

  private async showStep(btn: HTMLButtonElement, text: string): Promise<void> {
    btn.textContent = text
    await new Promise((r) => setTimeout(r, WorldBoardPage.MIN_STEP_MS))
  }

  private async runVerify(btn: HTMLButtonElement, r: InscriptionEntry): Promise<void> {
    if (!r.nft) return
    btn.disabled = true
    btn.classList.remove('ok', 'bad')
    try {
      const a = r.allocation
      await this.showStep(btn, $lang.verify_step1)
      const res = await verifyInscription({
        contract: r.nft.contract,
        tokenId: r.nft.tokenId,
        seed: r.seed,
        talentIds: r.talentIds ?? [],
        allocation: a ? [a.CHR, a.INT, a.STR, a.MNY] : [0, 0, 0, 0],
        randcastRequestTx: r.randcastRequestTx ?? null,
        owner: r.ownerWallet ?? null,
      })
      await this.showStep(btn, $lang.verify_step2)
      const replay = await core.replayFate(r).catch(() => null)
      const reproduced = replay ? replay.matched : true
      const ok = res.ok && reproduced
      btn.textContent = ok ? $lang.verify_ok : $lang.verify_fail
      btn.classList.add(ok ? 'ok' : 'bad')
      if (!ok) console.warn('[verify] mismatch', { record: r, onchain: res.onchain, checks: res.checks, replay })
    } catch (e) {
      console.error('[verify] error', e)
      btn.textContent = $lang.verify_error
      btn.disabled = false
    }
  }
}
