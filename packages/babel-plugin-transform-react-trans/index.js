export default function({ types: t }) {
  function isIdAttribute(node) {
    return t.isJSXAttribute(node) && t.isJSXIdentifier(node.name, {name: 'id'})
  }

  function isTransComponent(node) {
    return t.isJSXElement(node) && t.isJSXIdentifier(node.openingElement.name, { name: 'Trans' })
  }

  function cleanChildren(node) {
    node.children = []
    node.openingElement.selfClosing = true
  }

  return {
    visitor: {
      JSXElement({ node }) {
        if (!isTransComponent(node)) return

        const attrs = node.openingElement.attributes
        const children = node.children

        cleanChildren(node)

        // Don't add ID attribute if already exists
        if (attrs.some(isIdAttribute)) return

        let text = ""
        let params = []

        for (const child of children) {
          if (t.isJSXText(child)) {
            text += child.value

          } else if (t.isJSXExpressionContainer(child)) {
            const exp = child.expression

            if (t.isIdentifier(exp)) {
              text += `{${exp.name}}`
              params.push(t.objectProperty(exp, exp))

            } else if (t.isTemplateLiteral(exp)) {
              let parts = []

              exp.quasis.forEach((item, index) => {
                parts.push(item)

                if (!item.tail) parts.push(exp.expressions[index])
              })

              parts.forEach((item) => {
                if (t.isTemplateElement(item)) {
                  text += item.value.raw
                } else {
                  text += `{${item.name}}`
                  params.push(t.objectProperty(item, item))
                }
              })

            } else {
              text += exp.value
            }
          }
        }

        // Add generated ID...
        attrs.push(
          t.JSXAttribute(t.JSXIdentifier("id"), t.StringLiteral(text))
        )

        // ... and params if any.
        if (params.length) {
          attrs.push(
            t.JSXAttribute(
              t.JSXIdentifier("params"),
              t.JSXExpressionContainer(t.objectExpression(params)))
          )
        }
      }
    }
  }
}
