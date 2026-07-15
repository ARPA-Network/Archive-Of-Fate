import { h, button } from '../ui/dom'
import type { DialogInstance } from '../ui/UIManager'
import { $lang } from '../i18n'
import { $$event } from '../core/eventBus'
import { progression } from '../core/progression'

export class SaveLoadDialog implements DialogInstance {
  root: HTMLElement
  private textarea: HTMLTextAreaElement

  constructor() {
    this.textarea = h('textarea', {
      class: 'dialog-textarea',
      attrs: { placeholder: $lang.saveload_placeholder },
    }) as HTMLTextAreaElement

    const btnExport = button($lang.btn_export, () => this.onExport(), 'btn-cyan')
    const btnImport = button($lang.btn_import, () => this.onImport(), 'btn-primary')

    this.root = h('div', { class: 'dialog-box' }, [
      h('div', { class: 'dialog-title', text: $lang.saveload_title }),
      this.textarea,
      h('div', { class: 'dialog-row', style: { marginTop: '24px' } }, [btnExport, btnImport]),
      h('div', { class: 'dialog-row' }, [button($lang.cancel, () => window.$ui.closeTopDialog(), 'btn-ghost')]),
    ])
  }

  private onExport(): void {
    this.textarea.value = progression.exportSave()
    this.textarea.select()
    $$event('message', ['msg_exported'])
  }

  private onImport(): void {
    const ok = progression.importSave(this.textarea.value.trim())
    if (ok) {
      $$event('message', ['msg_imported'])
      setTimeout(() => window.location.reload(), 1000)
    } else {
      $$event('message', ['msg_import_fail'])
    }
  }

  close(): void {}
}
