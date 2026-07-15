import { Page } from '../ui/Page'
import { h, button } from '../ui/dom'
import { buildScreen, asset } from '../ui/screen'
import { $ui, core, UI } from '../globals'
import { $lang } from '../i18n'
import { $$event } from '../core/eventBus'
import { progression } from '../core/progression'
import { isInscribeConfigured, hasWallet, connect as chainConnect } from '../web3/chain'

export class ConnectWalletPage extends Page {
  readonly name = UI.pages.CONNECT_WALLET

  private usernameInput!: HTMLInputElement

  override init(args?: { error?: string }): void {
    const safe = buildScreen(this.root, { decoBars: true, bg: 'cw-bg.svg' })

    this.usernameInput = h('input', {
      class: 'cw-username',
      attrs: {
        type: 'text',
        maxlength: '12',
        placeholder: $lang.cw_username_ph,
        value: progression.username(),
      },
    }) as HTMLInputElement

    safe.append(
      button($lang.back, () => $ui.switchView(UI.pages.MAIN), 'btn--thin btn-back'),
      h('div', { class: 'cw-title txt', text: $lang.cw_title }),
      h('div', { class: 'cw-desc txt', html: this.descHtml() }),
      this.usernameInput,
    )

    if (args?.error) {
      safe.append(h('div', { class: 'cw-error txt', text: args.error }))
    }

    const connectBtn = button(
      '',
      () => this.onConnect(),
      'btn cw-connect',
    )
    connectBtn.append(
      document.createTextNode($lang.cw_connect),
      h('img', { attrs: { src: asset('wallet-icon.svg'), alt: '' } }),
    )

    safe.append(
      connectBtn,
      button($lang.cw_guest, () => this.onGuest(), 'btn cw-guest'),
    )
  }

  private descHtml(): string {
    return $lang.cw_desc
      .split('\n')
      .map((line) => `<p>${line}</p>`)
      .join('')
  }

  private onConnect(): void {
    progression.setUsername(this.usernameInput?.value ?? '')
    $$event('message', ['msg_wallet_connected'])
    $ui.switchView(UI.pages.LOADING, {
      task: async () => {
        $$event('loading_status', 'loading_connect')
        let addr: string | undefined
        if (isInscribeConfigured()) {
          if (!hasWallet()) throw new Error($lang.cw_no_wallet)
          try {
            addr = await chainConnect(true) 
          } catch {
            throw new Error($lang.cw_connect_fail) 
          }
        } else if (hasWallet()) {
          try {
            addr = await chainConnect()
          } catch {
          }
        }
        progression.connectWallet(addr)
        await core.prepareLife()
      },
      next: UI.pages.TALENT,
      errorNext: UI.pages.CONNECT_WALLET,
      minMs: 1000,
    })
  }

  private static readonly FREE_GUEST_GAMES = 10

  private onGuest(): void {
    if (progression.anonTimes() >= ConnectWalletPage.FREE_GUEST_GAMES) {
      $$event('message', ['guest_limit'])
      return
    }
    $ui.switchView(UI.pages.LOADING, {
      task: async () => {
        progression.disconnectWallet()
        await core.prepareLife()
      },
      next: UI.pages.TALENT,
      errorNext: UI.pages.CONNECT_WALLET,
      minMs: 600,
    })
  }
}
