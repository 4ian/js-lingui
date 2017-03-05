/* @flow */
import { I18n, default as exportedI18n } from '.'

describe('I18n', function () {
  it('should export default I18n instance', function () {
    expect(exportedI18n).toBeInstanceOf(I18n)
  })

  it('should be initialized with empty catalog', function () {
    const i18n = new I18n()
    expect(i18n.messages).toEqual({})
  })

  it('should bound t method', function () {
    const i18n = new I18n()
    expect(i18n.t).toBeInstanceOf(Function)

    expect(i18n.t`Message`).toEqual('Message')

    const name = 'Fred'
    expect(i18n.t`Hello ${name}`).toEqual('Hello Fred')
  })

  it('.load should load catalog and merge with existing', function () {
    const messages = {
      en: {
        'Hello': 'Hello'
      }
    }

    const i18n = new I18n()
    expect(i18n.messages).toEqual({})

    i18n.activate('en')
    i18n.load({ en: messages.en })
    expect(i18n.messages).toEqual(messages.en)

    // fr catalog shouldn't affect the english one
    i18n.load({ fr: { 'Hello': 'Salut' } })
    expect(i18n.messages).toEqual(messages.en)

    i18n.load({ en: { 'Goodbye': 'Goodbye' } })
    // $FlowIgnore: testing edge case
    i18n.load()  // should do nothing
    expect(i18n.messages).toEqual({
      'Hello': 'Hello',
      'Goodbye': 'Goodbye'
    })
  })

  it('.activate should switch active language', function () {
    const i18n = new I18n()
    const messages = {
      'Hello': 'Salut'
    }

    i18n.load({ fr: messages })
    i18n.activate('en')
    expect(i18n.language).toEqual('en')
    expect(i18n.messages).toEqual({})

    i18n.activate('fr')
    // $FlowIgnore: testing edge case
    i18n.activate()  // should do nothing
    expect(i18n.language).toEqual('fr')
    expect(i18n.messages).toEqual(messages)
  })

  it('.activate should throw an error about incorrect language', function () {
    const i18n = new I18n()
    expect(() => i18n.activate('xyz')).toThrowErrorMatchingSnapshot()
    expect(() => new I18n('xyz')).toThrowErrorMatchingSnapshot()
  })

  it('.use should return new i18n object with switched language', function () {
    const i18n = new I18n()
    const messages = {
      en: {
        'Hello': 'Hello'
      },
      fr: {
        'Hello': 'Salut'
      }
    }

    i18n.load(messages)
    i18n.activate('en')
    expect(i18n.translate({ id: 'Hello' })).toEqual('Hello')

    // change language locally
    expect(i18n.use('fr').translate({ id: 'Hello' })).toEqual('Salut')

    // global language hasn't changed
    expect(i18n.translate({ id: 'Hello' })).toEqual('Hello')
  })

  it('.translate should format message from catalog', function () {
    const i18n = new I18n()
    const messages = {
      'Hello': 'Salut',
      'My name is {name}': 'Je m\'appelle {name}'
    }

    i18n.load({ fr: messages })
    i18n.activate('fr')

    expect(i18n.translate({ id: 'Hello' })).toEqual('Salut')
    expect(i18n.translate({ id: 'My name is {name}', params: { name: 'Fred' } }))
      .toEqual("Je m'appelle Fred")

    // missing { name }
    expect(i18n.translate({ id: 'My name is {name}' }))
      .toEqual("Je m'appelle")

    // Untranslated message
    expect(i18n.translate({ id: 'Missing message' })).toEqual('Missing message')
  })

  it('.compile should return compiled message', function () {
    const i18n = new I18n()
    const messages = {
      'Hello': 'Salut',
      'My name is {name}': "Je m'appelle {name}"
    }

    i18n.load({ fr: messages })
    i18n.activate('fr')

    const msg = i18n.compile('My name is {name}')
    expect(msg).toBeInstanceOf(Function)
    expect(msg({ name: 'Fred' })).toEqual('My name is Fred')
  })
})
