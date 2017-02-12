// @flow
import React from 'react'

import WithI18n from './WithI18n'
import type { WithI18nProps } from './WithI18n'
import { formatElements } from './format'

type TransProps = {
  id?: string,
  defaults?: string,
  params?: Object,
  components?: Array<React$Element<any>>,

  className?: string
} & WithI18nProps

type TransState = {
  msgCache: Function,
  language: string,
  translation: string
}

class Trans extends React.Component<*, TransProps, TransState> {
  props: TransProps
  state: TransState

  static defaultProps = {
    i18n: {}
  }

  constructor (props, context) {
    super(props, context)

    const translation = this.getTranslation(props)
    this.state = {
      msgCache: this.compileMessage(translation),
      language: props.i18n.language,
      translation
    }
  }

  getTranslation (props): string {
    const { id = '', defaults, i18n } = props

    return (i18n.messages ? i18n.messages[id] : '') || defaults || id
  }

  compileMessage (translation: string): Function {
    const { i18n } = this.props

    if (!i18n.compile) return () => translation
    return i18n.compile(translation)
  }

  componentWillReceiveProps (nextProps) {
    const { i18n } = this.props
    const { language, translation } = this.state
    const nextTranslation = this.getTranslation(nextProps)

    if (
      translation !== nextTranslation ||
      language !== i18n.language
    ) {
      this.setState({
        msgCache: this.compileMessage(nextTranslation),
        language: i18n.language,
        translation: nextTranslation
      })
    }
  }

  render () {
    const {
      params, components, className
    } = this.props
    const { msgCache } = this.state

    const translation = formatElements(msgCache(params), components)

    return <span className={className}>{translation}</span>
  }
}

export default WithI18n()(Trans)
