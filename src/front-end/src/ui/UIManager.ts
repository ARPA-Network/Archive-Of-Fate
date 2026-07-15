import { Page, type PageArgs, type PageClass } from './Page'
import { $$on } from '../core/eventBus'
import { Events } from '../core/enums'
import { $lang, type LangKey } from '../i18n'
import { showMessage } from '../popups/MessagePopup'
import { showAchievementPopup } from '../popups/AchievementPopup'

export interface DialogInstance {
  root: HTMLElement
  close(): void
}

const LOADING_OVERLAY_DELAY = 3000

export class UIManager {
  private viewLayer: HTMLElement
  private dialogLayer: HTMLElement
  private popupLayer: HTMLElement
  private current: Page | null = null
  private currentName = ''
  private pageRegistry = new Map<string, PageClass>()
  private dialogs: DialogInstance[] = []
  private switching = false

  constructor() {
    this.viewLayer = document.getElementById('layer-view')!
    this.dialogLayer = document.getElementById('layer-dialog')!
    this.popupLayer = document.getElementById('layer-popup')!

    $$on(Events.MESSAGE, (args: [LangKey, ...unknown[]] | string) => {
      if (Array.isArray(args)) {
        const [key, ...rest] = args
        showMessage(this.popupLayer, $lang.t(key as LangKey, ...rest))
      } else {
        showMessage(this.popupLayer, String(args))
      }
    })
    $$on(Events.ACHIEVEMENT, (data: { name: string; grade: number }) => {
      showAchievementPopup(this.popupLayer, data)
    })
  }

  registerPage(name: string, cls: PageClass): void {
    this.pageRegistry.set(name, cls)
  }

  get currentPageName(): string {
    return this.currentName
  }

  async switchView(name: string, args?: PageArgs): Promise<void> {
    if (this.switching) return
    this.switching = true
    const overlayTimer = window.setTimeout(
      () => this.showLoadingOverlay(true),
      LOADING_OVERLAY_DELAY,
    )
    try {
      const cls = this.pageRegistry.get(name)
      if (!cls) throw new Error(`Page not registered: ${name}`)

      cls.load?.()

      if (this.current) {
        this.current.close()
        this.current.root.remove()
      }

      const page = new (cls as new () => Page)()
      await page.init(args)

      this.viewLayer.appendChild(page.root)
      this.current = page
      this.currentName = name

      page.show()
    } catch (e) {
      console.error('[UIManager.switchView] error', e)
    } finally {
      window.clearTimeout(overlayTimer)
      this.showLoadingOverlay(false)
      this.switching = false
    }
  }

  openDialog(instance: DialogInstance): void {
    const mask = document.createElement('div')
    mask.className = 'dialog-mask'
    mask.appendChild(instance.root)
    mask.addEventListener('click', (e) => {
      if (e.target === mask) this.closeTopDialog()
    })
    this.dialogLayer.appendChild(mask)
    this.dialogs.push({ root: mask, close: instance.close })
  }

  closeTopDialog(): void {
    const top = this.dialogs.pop()
    if (top) {
      try {
        top.close()
      } catch {
      }
      top.root.remove()
    }
  }

  closeAllDialogs(): void {
    while (this.dialogs.length) this.closeTopDialog()
  }

  private overlay: HTMLElement | null = null
  private showLoadingOverlay(visible: boolean): void {
    if (visible) {
      if (this.overlay) return
      const el = document.createElement('div')
      el.className = 'traj-loading'
      el.style.zIndex = '5'
      el.style.position = 'absolute'
      el.style.inset = '0'
      el.style.background = '#000'
      el.textContent = $lang.loading
      this.popupLayer.appendChild(el)
      this.overlay = el
    } else if (this.overlay) {
      this.overlay.remove()
      this.overlay = null
    }
  }
}
