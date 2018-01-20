const nlRe = /(?:\r\n|\r|\n)+\s+/g

const pluralRules = ["zero", "one", "two", "few", "many", "other"]

const generatorFactory = (index = 0) => () => index++

const initialProps = () => ({
  text: "",
  values: {},
  formats: {}
})

// Plugin function
export default function({ types: t }) {
  let argumentGenerator

  const isI18nMethod = node =>
    (t.isMemberExpression(node.tag) &&
      t.isIdentifier(node.tag.object, { name: "i18n" }) &&
      t.isIdentifier(node.tag.property, { name: "t" })) ||
    (t.isCallExpression(node.tag) &&
      t.isMemberExpression(node.tag.callee) &&
      t.isIdentifier(node.tag.callee.object, { name: "i18n" }) &&
      t.isIdentifier(node.tag.callee.property, { name: "t" }))

  const isChoiceMethod = node =>
    t.isMemberExpression(node) &&
    t.isIdentifier(node.object, { name: "i18n" }) &&
    (t.isIdentifier(node.property, { name: "plural" }) ||
      t.isIdentifier(node.property, { name: "select" }) ||
      t.isIdentifier(node.property, { name: "selectOrdinal" }))

  const isFormatMethod = node =>
    t.isMemberExpression(node) &&
    t.isIdentifier(node.object, { name: "i18n" }) &&
    (t.isIdentifier(node.property, { name: "date" }) ||
      t.isIdentifier(node.property, { name: "number" }))

  function processMethod(node, file, props, root = false) {
    // i18n.t
    if (isI18nMethod(node)) {
      if (t.isCallExpression(node.tag)) {
        const defaults = node.tag.arguments[0]
        if (!t.isStringLiteral(defaults)) {
          throw file.buildCodeFrameError(
            node.tag,
            "Message ID must be a string"
          )
        }
        processTemplateLiteral(node.quasi, file, props)
        return {
          ...props,
          text: defaults.value,
          defaults: props.text
        }
      } else {
        processTemplateLiteral(node.quasi, file, props)
        return props
      }

      // i18n.plural and i18n.select
    } else if (isChoiceMethod(node.callee)) {
      const exp = node

      const choices = {}
      const choicesType = node.callee.property.name.toLowerCase()
      let variable
      let offset = ""

      const arg = exp.arguments[0]

      for (const attr of arg.properties) {
        if (attr.computed) {
          throw file.buildCodeFrameError(
            attr,
            "Computed properties aren't allowed."
          )
        }

        const { key } = attr
        // key is either:
        // NumericLiteral => convert to `={number}`
        // StringLiteral => key.value
        // Literal => key.name
        const name = t.isNumericLiteral(key)
          ? `=${key.value}`
          : key.name || key.value

        if (name === "value") {
          const exp = attr.value
          variable = t.isIdentifier(exp) ? exp.name : argumentGenerator()
          const key = t.isIdentifier(exp) ? exp : t.numericLiteral(variable)
          props.values[variable] = t.objectProperty(key, exp)
        } else if (choicesType !== "select" && name === "offset") {
          // offset is static parameter, so it must be either string or number
          if (
            !t.isNumericLiteral(attr.value) &&
            !t.isStringLiteral(attr.value)
          ) {
            throw file.buildCodeFrameError(
              node.callee,
              "Offset argument cannot be a variable."
            )
          }
          offset = ` offset:${attr.value.value}`
        } else {
          let value = ""

          if (t.isTemplateLiteral(attr.value)) {
            props = processTemplateLiteral(
              attr.value,
              file,
              Object.assign({}, props, { text: "" })
            )
            value = props.text
          } else if (t.isCallExpression(attr.value)) {
            props = processMethod(
              attr.value,
              file,
              Object.assign({}, props, { text: "" })
            )
            value = props.text
          } else {
            value = attr.value.value
          }
          choices[name] = value
        }
      }

      // missing value
      if (variable === undefined) {
        throw file.buildCodeFrameError(
          node.callee,
          "Value argument is missing."
        )
      }

      const choicesKeys = Object.keys(choices)

      // 'other' choice is required
      if (!choicesKeys.length) {
        throw file.buildCodeFrameError(
          node.callee,
          `Missing ${choicesType} choices. At least fallback argument 'other' is required.`
        )
      } else if (!Array.includes(choicesKeys, "other")) {
        throw file.buildCodeFrameError(
          node.callee,
          `Missing fallback argument 'other'.`
        )
      }

      // validate plural rules
      if (choicesType === "plural" || choicesType === "selectordinal") {
        choicesKeys.forEach(rule => {
          if (!Array.includes(pluralRules, rule) && !/=\d+/.test(rule)) {
            throw file.buildCodeFrameError(
              node.callee,
              `Invalid plural rule '${rule}'. Must be ${pluralRules.join(
                ", "
              )} or exact number depending on your source language ('one' and 'other' for English).`
            )
          }
        })
      }

      const argument = choicesKeys
        .map(form => `${form} {${choices[form]}}`)
        .join(" ")
      const format = `${variable}, ${choicesType},${offset} ${argument}`
      props.text = root ? `{${format}}` : format
    } else if (isFormatMethod(node.callee)) {
      const exp = node.arguments[0]

      // missing value
      if (exp === undefined) {
        throw file.buildCodeFrameError(
          node.callee,
          "The first argument of format function must be a variable."
        )
      }

      const variable = t.isIdentifier(exp) ? exp.name : argumentGenerator()
      const key = t.isIdentifier(exp) ? exp : t.numericLiteral(variable)

      const type = node.callee.property.name
      const parts = [
        variable, // variable name
        type // format type
      ]

      let format = ""
      const formatArg = node.arguments[1]
      if (!formatArg) {
        // Do not throw validation error when format doesn't exist
      } else if (t.isStringLiteral(formatArg)) {
        format = formatArg.value
      } else if (t.isIdentifier(formatArg) || t.isObjectExpression(formatArg)) {
        if (t.isIdentifier(formatArg)) {
          format = formatArg.name
        } else {
          const formatName = new RegExp(`^${type}\\d+$`)
          const existing = Object.keys(props.formats).filter(name =>
            formatName.test(name)
          )
          format = `${type}${existing.length || 0}`
        }

        props.formats[format] = t.objectProperty(
          t.identifier(format),
          formatArg
        )
      } else {
        throw file.buildCodeFrameError(
          formatArg,
          "Format can be either string for buil-in formats, variable or object for custom defined formats."
        )
      }

      if (format) parts.push(format)

      props.values[variable] = t.objectProperty(key, exp)
      props.text += `${parts.join(",")}`
    }

    return props
  }

  function processTemplateLiteral(exp, file, props) {
    let parts = []

    exp.quasis.forEach((item, index) => {
      parts.push(item)

      if (!item.tail) parts.push(exp.expressions[index])
    })

    parts.forEach(item => {
      if (t.isTemplateElement(item)) {
        props.text += item.value.raw
      } else if (
        t.isCallExpression(item) &&
        (isI18nMethod(item.callee) ||
          isChoiceMethod(item.callee) ||
          isFormatMethod(item.callee))
      ) {
        const { text } = processMethod(item, file, { ...props, text: "" })
        props.text += `{${text}}`
      } else {
        const name = t.isIdentifier(item) ? item.name : argumentGenerator()
        const key = t.isIdentifier(item) ? item : t.numericLiteral(name)

        // const [name, key] = t.isIdentifier(item)
        //   ? [item.name, item]
        //   : [argumentGenerator(), t.numericLiteral(name)]
        props.text += `{${name}}`
        props.values[name] = t.objectProperty(key, item)
      }
    })

    return props
  }

  function CallExpression(path, { file }) {
    argumentGenerator = generatorFactory()

    // 1. Collect all parameters and generate message ID

    const props = processMethod(path.node, file, initialProps(), true)

    const text = props.text.replace(nlRe, " ").trim()
    if (!text) return

    // 2. Replace complex expression with single call to i18n._

    const tOptions = []

    const formatsList = Object.values(props.formats)
    if (formatsList.length) {
      tOptions.push(
        t.objectProperty(
          t.identifier("formats"),
          t.objectExpression(formatsList)
        )
      )
    }

    if (props.defaults) {
      tOptions.push(
        t.objectProperty(
          t.identifier("defaults"),
          t.stringLiteral(props.defaults)
        )
      )
    }

    // arguments of i18n._(messageId: string, values: Object, options: Object)
    const tArgs = [t.StringLiteral(text)] // messageId

    const valuesList = Object.values(props.values)
    // omit second argument when there're no values and no options,
    // i.e: simplify i18n._(id, {}) to i18n._(id)
    if (valuesList.length || tOptions.length) {
      tArgs.push(t.objectExpression(valuesList.length ? valuesList : []))
    }

    // add options argument
    if (tOptions.length) tArgs.push(t.objectExpression(tOptions))

    // replace i18n.t`...` with i18n._(...), but remember original location
    const exp = t.callExpression(
      t.memberExpression(t.identifier("i18n"), t.identifier("_")),
      tArgs
    )
    exp.loc = path.node.loc
    path.replaceWith(exp)
  }

  return {
    visitor: {
      CallExpression,
      TaggedTemplateExpression: CallExpression
    }
  }
}
