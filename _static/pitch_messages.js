import * as React from "react"
import { I18n, Trans, Plural } from "@lingui/react"

export default function Lingui({ numUsers, name = "You" }) {
  return (
    <div>
      <h1>
        {/* Localized messages are simply wrapped in <Trans> */}
        <Trans>Internationalization in React</Trans>
      </h1>

      {/* Element attributes are translated using i18n core object */}
      <I18n>
        {({ i18n }) => (
          <img src="./logo.png" alt={i18n.t`Logo of Lingui Project`} />
        )}
      </I18n>

      <p className="lead">
        {/* Variables are passed to messages in the same way as in JSX */}
        <Trans>
          Hello {name}, LinguiJS is a readable, automated, and optimized (5 kb)
          internationalization for JavaScript.
        </Trans>
      </p>

      {/* Rendering of translation is customizable. Here it renders inside <p> */}
      <Trans render="p">
        {/* Also React Elements inside messages works in the same way as in JSX */}
        Read the <a href="https://lingui.js.org">documentation</a>
        for more info.
      </Trans>

      {/*
        Plurals are managed using ICU plural rules.
        Content of one/other slots is localized using <Trans>.
        Nesting of i18n components is allowed.
        Syntactically valid message in ICU MessageFormat is guaranteed.
      */}
      <Plural
        value={numUsers}
        one={
          <span>
            Only <strong>one</strong> user is using this library!
          </span>
        }
        other={
          <span>
            <strong>{numUsers}</strong> users are using this library!
          </span>
        }
      />
    </div>
  )
}
