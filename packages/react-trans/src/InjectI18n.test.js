import React from 'react'
import { mount } from 'enzyme'

import { InjectI18n } from '.'

describe('InjectI18n', function() {
  const context = {
    language: 'en',
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
  }

  // Pass all props to spy on render
  const sinkFactory = () => {
    const spy = jest.fn()
    const Sink = InjectI18n((props) => {
      spy(props)
      return null
    })
    return { Sink, spy }
  }

  // Mount HOC(sink) and get the props which were passed from HOC
  const mountHoc = (props = {}, customContext = context) => {
    const { Sink, spy } = sinkFactory()
    const node = mount(<Sink {...props} />, { context: { i18n: customContext }})
    const receivedProps = spy.mock.calls[spy.mock.calls.length - 1][0]

    // Original props are passed with along with i18n prop
    return { node, props: receivedProps }
  }

  beforeEach(() => {
    context.subscribe.mockReset()
    context.unsubscribe.mockReset()
  })

  it('should pass all props to wrapped component', function() {
    const props = {
      foo: 'bar',
      value: 1
    }

    const { i18n, ...calledProps } = mountHoc(props).props
    expect(calledProps).toEqual(props)
  })

  it('should provide data from i18n context', function() {
    const { i18n } = mountHoc().props
    expect(i18n).toBeDefined()
    expect(i18n.language).toBeDefined()
    expect(i18n.translate).toBeInstanceOf(Function)
  })

  it('should subscribe a callback on mount', function() {
    expect(context.subscribe).not.toBeCalled()
    mountHoc()
    expect(context.subscribe).toBeCalled()
    expect(context.subscribe.mock.calls[0][0]).toBeInstanceOf(Function)
  })

  it('should unsubscribe a callback on unmount', function() {
    const { node } = mountHoc()

    expect(context.unsubscribe).not.toBeCalled()
    node.unmount()
    expect(context.unsubscribe).toBeCalled()
    expect(context.unsubscribe.mock.calls[0][0]).toBeInstanceOf(Function)
  })
})
