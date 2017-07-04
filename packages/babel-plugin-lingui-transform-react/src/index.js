const pluralRules = ['zero', 'one', 'two', 'few', 'many', 'other']
const commonProps = ['id', 'className', 'render']

const nlRe = /(?:\r\n|\r|\n)+\s+/g

function cleanChildren (node) {
  node.children = []
  node.openingElement.selfClosing = true
}

const mergeProps = (props, nextProps) => ({
  text: props.text + nextProps.text,
  values: Object.assign({}, props.values, nextProps.values),
  components: props.components.concat(nextProps.components),
  formats: props.formats,
  elementIndex: nextProps.elementIndex
})

const initialProps = ({ formats } = {}) => ({
  text: '',
  values: {},
  components: [],
  formats: formats || {}
})

const generatorFactory = (index = 0) => () => index++

// Plugin function
export default function ({ types: t }) {
  let elementGenerator
  let argumentGenerator

  function isIdAttribute (node) {
    return t.isJSXAttribute(node) && t.isJSXIdentifier(node.name, {name: 'id'})
  }

  function isDefaultsAttribute (node) {
    return t.isJSXAttribute(node) && t.isJSXIdentifier(node.name, {name: 'defaults'})
  }

  const elementName = name => node =>
    t.isJSXElement(node) && t.isJSXIdentifier(node.openingElement.name, { name })

  const isTransElement = elementName('Trans')
  const isChooseElement = (node) => (
    elementName('Plural')(node) ||
    elementName('Select')(node) ||
    elementName('SelectOrdinal')(node)
  )
  const isFormatElement = (node) => (
    elementName('DateFormat')(node) ||
    elementName('NumberFormat')(node)
  )

  function processElement (node, file, props, root = false) {
    const element = node.openingElement

    // Trans
    if (isTransElement(node)) {
      for (const child of node.children) {
        props = processChildren(child, file, props)
      }

    // Plural, Select, SelectOrdinal
    } else if (isChooseElement(node)) {
      if (node.children.length) {
        throw file.buildCodeFrameError(element, `Children of ${element.name.name} aren't allowed.`)
      }

      const choicesType = element.name.name.toLowerCase()
      const choices = {}
      let variable
      let offset = ''

      for (const attr of element.attributes) {
        const { name: { name } } = attr

        if (name === 'value') {
          const exp = attr.value.expression

          // value must be a variable
          if (!t.isIdentifier(exp)) {
            throw file.buildCodeFrameError(element, 'Value must be a variable.')
          }

          variable = exp.name
          props.values[variable] = t.objectProperty(exp, exp)
        } else if (Array.includes(commonProps, name)) {
          // just do nothing
        } else if (choicesType !== 'select' && name === 'offset') {
          // offset is static parameter, so it must be either string or number
          if (!t.isNumericLiteral(attr.value) && !t.isStringLiteral(attr.value)) {
            throw file.buildCodeFrameError(element, 'Offset argument cannot be a variable.')
          }

          offset = ` offset:${attr.value.value}`
        } else {
          props = processChildren(attr.value, file, Object.assign({}, props, { text: '' }))
          choices[name.replace('_', '=')] = props.text
        }
      }

      // missing value
      if (!variable) {
        throw file.buildCodeFrameError(element, 'Value argument is missing.')
      }

      const choicesKeys = Object.keys(choices)

      // 'other' choice is required
      if (!choicesKeys.length) {
        throw file.buildCodeFrameError(
          element,
          `Missing ${choicesType} choices. At least fallback argument 'other' is required.`
        )
      } else if (!Array.includes(choicesKeys, 'other')) {
        throw file.buildCodeFrameError(
          element, `Missing fallback argument 'other'.`)
      }

      // validate plural rules
      if (choicesType === 'plural' || choicesType === 'selectordinal') {
        choicesKeys.forEach(rule => {
          if (!Array.includes(pluralRules, rule) && !/=\d+/.test(rule)) {
            throw file.buildCodeFrameError(
              element,
              `Invalid plural rule '${rule}'. Must be ${pluralRules.join(', ')} or exact number depending on your source language ('one' and 'other' for English).`
            )
          }
        })
      }

      const argument = choicesKeys.map(form => `${form} {${choices[form]}}`).join(' ')

      props.text = `{${variable}, ${choicesType},${offset} ${argument}}`
      element.attributes = element.attributes.filter(attr => Array.includes(commonProps, attr.name.name))
      element.name = t.JSXIdentifier('Trans')
    } else if (isFormatElement(node)) {
      if (root) {
        // Don't convert standalone Format elements to ICU MessageFormat.
        // It doesn't make sense to have `{name, number}` message, because we
        // can call number() formatter directly in component.
        return
      }

      const type = element.name.name.toLowerCase().replace('format', '')

      let variable, format

      for (const attr of element.attributes) {
        const { name: { name } } = attr

        if (name === 'value') {
          const exp = attr.value.expression

          // value must be a variable
          if (!t.isIdentifier(exp)) {
            throw file.buildCodeFrameError(element, 'Value must be a variable.')
          }

          variable = exp.name
          props.values[variable] = t.objectProperty(exp, exp)
        } else if (name === 'format') {
          if (t.isStringLiteral(attr.value)) {
            format = attr.value.value
          } else if (t.isJSXExpressionContainer(attr.value)) {
            const exp = attr.value.expression
            if (t.isStringLiteral(exp)) {
              format = exp.value
            } else if (t.isObjectExpression(exp) || t.isIdentifier(exp)) {
              if (t.isIdentifier(exp)) {
                format = exp.name
              } else {
                const formatName = new RegExp(`^${type}\\d+$`)
                const existing = Object.keys(props.formats)
                  .filter(name => formatName.test(name))
                format = `${type}${existing.length || 0}`
              }
              props.formats[format] = t.objectProperty(t.identifier(format), exp)
            }
          }

          if (!format) {
            throw file.buildCodeFrameError(element, 'Format can be either string for buil-in formats, variable or object for custom defined formats.')
          }
        }
      }

      // missing value
      if (!variable) {
        throw file.buildCodeFrameError(element, 'Value argument is missing.')
      }

      const parts = [
        variable,
        type
      ]

      if (format) parts.push(format)

      props.text = `{${parts.join(',')}}`
      element.attributes = element.attributes.filter(attr => Array.includes(commonProps, attr.name.name))
      element.name = t.JSXIdentifier('Trans')
    // Other elements
    } else {
      if (root) return

      const index = elementGenerator()
      const selfClosing = node.openingElement.selfClosing

      props.text += !selfClosing ? `<${index}>` : `<${index}/>`

      for (const child of node.children) {
        props = processChildren(child, file, props)
      }

      if (!selfClosing) props.text += `</${index}>`

      cleanChildren(node)
      props.components.unshift(node)
    }

    return props
  }

  function processChildren (node, file, props) {
    let nextProps = initialProps({ formats: props.formats })

    if (t.isJSXExpressionContainer(node)) {
      const exp = node.expression

      if (t.isStringLiteral(exp)) {
        nextProps.text += exp.value
      } else if (t.isTemplateLiteral(exp)) {
        let parts = []

        exp.quasis.forEach((item, index) => {
          parts.push(item)

          if (!item.tail) parts.push(exp.expressions[index])
        })

        parts.forEach((item) => {
          if (t.isTemplateElement(item)) {
            nextProps.text += item.value.raw
          } else {
            nextProps.text += `{${item.name}}`
            nextProps.values[item.name] = t.objectProperty(item, item)
          }
        })
      } else if (t.isJSXElement(exp)) {
        nextProps = processElement(exp, file, nextProps)
      } else {
        const name = t.isIdentifier(exp) ? exp.name : argumentGenerator()
        const key = t.isIdentifier(exp) ? exp : t.numericLiteral(name)
        nextProps.text += `{${name}}`
        nextProps.values[name] = t.objectProperty(key, exp)
      }
    } else if (t.isJSXElement(node)) {
      nextProps = processElement(node, file, nextProps)
    } else if (t.isJSXSpreadChild(node)) {
      // TODO: I don't have a clue what's the usecase

    } else {
      nextProps.text += node.value
    }

    return mergeProps(props, nextProps)
  }

  return {
    visitor: {
      JSXElement (path, file) {
        const { node } = path
        elementGenerator = generatorFactory()
        argumentGenerator = generatorFactory()

        // 1. Collect all parameters and inline elements and generate message ID

        const props = processElement(node, file, initialProps(), /* root= */true)

        if (!props) return

        // 2. Replace children and add collected data

        cleanChildren(node)
        const text = props.text.replace(nlRe, '').trim()
        let attrs = node.openingElement.attributes

        // If `id` prop already exists and generated ID is different,
        // add it as a `default` prop
        const idAttr = attrs.filter(isIdAttribute)[0]
        if (idAttr && text && idAttr.value.value !== text) {
          attrs.push(
            t.JSXAttribute(t.JSXIdentifier('defaults'), t.StringLiteral(text))
          )
        } else if (!idAttr) {
          attrs.push(
            t.JSXAttribute(t.JSXIdentifier('id'), t.StringLiteral(text))
          )
        }

        // Parameters for variable substitution
        const valuesList = Object.values(props.values)
        if (valuesList.length) {
          attrs.push(
            t.JSXAttribute(
              t.JSXIdentifier('values'),
              t.JSXExpressionContainer(t.objectExpression(valuesList)))
          )
        }

        // Inline elements
        if (props.components.length) {
          attrs.push(
            t.JSXAttribute(
              t.JSXIdentifier('components'),
              t.JSXExpressionContainer(t.arrayExpression(props.components))
            )
          )
        }

        // Custom formats
        const formatsList = Object.values(props.formats)
        if (formatsList.length) {
          attrs.push(
            t.JSXAttribute(
              t.JSXIdentifier('formats'),
              t.JSXExpressionContainer(t.objectExpression(formatsList)))
          )
        }

        if (process.env.NODE_ENV === 'production') {
          node.openingElement.attributes = attrs.filter(node => !isDefaultsAttribute(node))
        }
      } // JSXElement
    } // visitor
  }
}
