/* @flow */
import MessageFormat from 'messageformat'
import t from './t'
import { select, plural, selectOrdinal } from './select'
import plurals from './plurals'

type Catalog = {[key: string]: string}
type Catalogs = {[key: string]: Catalog}

type Message = {|
  id: string,
  defaults?: string,
  params?: Object
|}

class I18n {
  _language: string
  _messages: Catalogs

  t: Function
  plural: Function
  select: Function
  selectOrdinal: Function

  constructor (language: string = '', messages: Catalogs = {}) {
    this._language = language
    this._messages = messages

    this.t = t(this)
    this.plural = plural(this)
    this.select = select
    this.selectOrdinal = selectOrdinal(this)
  }

  get messages (): Catalog {
    return this._messages[this._language] || {}
  }

  get language (): string {
    return this._language
  }

  load (messages: Catalogs) {
    if (!messages) return

    // deeply merge Catalogs
    Object.keys({ ...this._messages, ...messages }).forEach(language => {
      if (!this._messages[language]) this._messages[language] = {}

      Object.assign(
        this._messages[language],
        messages[language] || {}
      )
    })
  }

  activate (language: string) {
    if (language) this._language = language
  }

  use (language: string) {
    return new I18n(language, this._messages)
  }

  translate ({ id, defaults, params = {} }: Message) {
    const translation = this.messages[id] || defaults || id
    return this.compile(translation)(params)
  }

  compile (message: string) {
    return new MessageFormat(this.language).compile(message)
  }

  pluralForm (n: number, cardinal?: 'cardinal' | 'ordinal' = 'cardinal'): string {
    const forms = plurals[this._language]
    const form = forms[cardinal]
    return form ? form(n) : 'other'
  }
}

export default new I18n()
export { I18n }
export type { Message, Catalog, Catalogs }
