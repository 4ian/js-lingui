// @flow
import { date, number } from 'lingui-formats'

import { compileMessage, loadLanguageData } from './utils.dev'

const isString = s => typeof s === 'string'

const defaultFormats = (language, languageData = {}, formatStyles = {}) => {
  const plurals = languageData.plurals
  const style = format => isString(format)
    ? formatStyles[format] || { style: format }
    : format

  const replaceOctothorpe = (value, message) => {
    return ctx => {
      const msg = typeof message === 'function' ? message(ctx) : message
      const norm = Array.isArray(msg) ? msg : [msg]
      return norm.map(m => isString(m) ? m.replace('#', value) : m)
    }
  }

  return {
    plural: (value, { offset = 0, ...rules }) => {
      const message = rules[value] || rules[plurals(value - offset)] || rules.other
      return replaceOctothorpe(value - offset, message)
    },

    selectordinal: (value, { offset = 0, ...rules }) => {
      const message = rules[value] || rules[plurals(value - offset, true)] || rules.other
      return replaceOctothorpe(value - offset, message)
    },

    select: (value, rules) =>
      rules[value] || rules.other,

    number: (value, format) =>
      number(language, style(format))(value),

    date: (value, format) =>
      date(language, style(format))(value),

    undefined: value => value
  }
}

// Message -> (Params -> String)
export default function compile (
  language: string,
  message: string | Function,
  languageData?: Object,
  formatStyles?: Object
): (params?: Object) => string {
  let formattedMessage = message

  if (typeof message === 'string') {
    if (process.env.NODE_ENV !== 'production') {
      formattedMessage = compileMessage(message)
      languageData = loadLanguageData(language)
    } else {
      // constant message
      // $FlowIgnore: message is string, we're inside typeof guard
      return (params?: Object) => message
    }
  }

  return (params?: Object = {}) => {
    // $FlowIgnore: formattedMessage is always a function
    const message = formattedMessage(context({
      language, params, formatStyles, languageData
    }))
    return Array.isArray(message) ? message.join('').trim() : message
  }
}

// Params -> CTX
function context ({ language, params, formatStyles, languageData }) {
  const formats = defaultFormats(language, languageData, formatStyles)

  const ctx = (name, type, format) => {
    const value = params[name]
    const formatted = formats[type](value, format)
    const message = typeof formatted === 'function' ? formatted(ctx) : formatted
    return Array.isArray(message) ? message.join('') : message
  }

  return ctx
}
