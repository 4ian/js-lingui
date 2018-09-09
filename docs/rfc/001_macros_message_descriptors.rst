************************************
001 - Macros for message descriptors
************************************

Proposal for a new ``@lingui/core`` message macros using Babel macros.

Background
==========

Macros are used for generating messages in ICU MessageFormat syntax. The advantages over
writing format by hand are following:

- API of macros is much simpler than API of underlying I18n method:

  .. code-block:: jsx

     import { setupI18n } from `@lingui/core`
     import { t } from `@lingui/macro`

     const i18n = setupI18n()
     const name = "Joe"
     const date = new Date()

     // With macro
     i18n(t`Hello ${name}, today is ${date(today)}`)

     // Without macro
     i18n('Hello {name}, today is {today, date}', { name, date })

     // For the sake of completeness, macro is transformed into this code:
     // i18n({
     //   id: 'Hello {name}, today is {today, date}',
     //   values: { name, date }
     //  })
     //
     // i18n(id, values) is a shortcut for i18n({ id, values }):

- Messages are validated and type-checked. Generated message is always syntactically
  valid. This is especially important for nested formatters:

  .. code-block:: jsx

     import { setupI18n } from `@lingui/core`
     import { t, plural } from `@lingui/macro`

     const i18n = setupI18n()
     const name = "Joe"
     const value = 42

     // With macro
     i18n(t`Hello ${name}, you have ${plural({
       value,
       one: '# unread message',
       other: '# unread messages'
     })}`)

     // Without macro
     i18n(
       'Hello {name}, you have {value, plural, one {# unread message} other {# unread messages}}',
       { name, date }
     )

- Using abstraction over message syntax allow easy replacement of message syntax.
  For example, without rewriting code it's possible to switch from ICU MessageFormat
  to Fluent_:

  .. code-block:: jsx

     import { setupI18n } from `@lingui/core`
     import { t } from `@lingui/macro`

     const i18n = setupI18n()
     const name = "Joe"
     const date = new Date()

     i18n(t`Hello ${name}, today is ${date(today)}`)

     // Lingui configration { messageFormat: 'icu' }
     // ↓ ↓ ↓ ↓ ↓ ↓
     // i18n({
     //   id: 'Hello {name}, today is {today, date}',
     //   values: { name, date }
     //  })

     // Lingui configration { messageFormat: 'fluent' }
     // ↓ ↓ ↓ ↓ ↓ ↓
     // i18n({
     //   id: 'Hello { $name }, today is { DATETIME($today) }',
     //   values: { name, date }
     //  })

  .. warning::

     Fluent_ format isn't supported at the moment, nor the ``messageFormat``
     configuration. It's possible however, that this will be possible in the future.

Proposal
========

All macros (``t``, ``plural``, ``select``, ``selectOrdinal``) are transformed into
*Message Descriptor* which is an object of following type:

.. code-block:: jsx

   type MessageDescriptor = {
      id: String,
      defaults?: String,
      values?: Object,
      formats?: Object,
   }

``id`` is message ID and the only required parameter. ``id`` and ``defaults``
are extracted to message catalog. Only ``id``, ``values``, and ``formats``
are used at runtime, all other attributes are removed from production code
for size optimization.

Generated *Message Descriptor* must be passed to ``i18n`` object, which is callable,
to perform the translation and formatting:

.. code-block:: jsx

  import { setupI18n } from `@lingui/core`
  import { t } from `@lingui/macro`

  // Setup i18n and load messages
  const i18n = setupI18n()
  i18n.load({
    cs: {
      messages: {
        'Hello {name}, today is {today, date}': 'Zdravím {name}, dnes je {today, date}'
      }
    }
  }

  // Define message
  const name = "Joe"
  const date = new Date()
  const message = t`Hello ${name}, today is ${date(today)}`

  // Translate and format message
  i18n.activate('cs')
  const translation = i18n(message) // === 'Zdravím Joe, dnes je 8. září 2018'

Let's take a look at specific use cases. There're always two variants:

- generated message is used as message ID
- custom ID is provided and generated message is used as a default one


.. note:: In following examples, ``i18n`` object is ommited to simplify code.

Message used as ID
------------------

Messages are generated using ``t`` macro used as a template tag:

.. code-block:: jsx

   import { t } from '@lingui/macro'

   // Macro
   t`Default message`

   // ↓ ↓ ↓ ↓ ↓ ↓
   /*i18n*/{
     id: 'Default message'
   }

With variables:

.. code-block:: jsx

   import { t } from '@lingui/macro'

   // Macro
   t`Default message with ${param}`

   // ↓ ↓ ↓ ↓ ↓ ↓
   /*i18n*/{
     id: 'Default message with {param}',
     values: { param }
   }

plurals and other formatters
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

``plural``, ``select``, and ``selectOrdinal`` are very similar to each other. They
are called with an object with all formatting parameters, like ``value`` and plural
forms. Here's the example of ``plural``:

.. code-block:: jsx

   import { plural } from '@lingui/macro'

   // Macro
   plural({ value, one: "# book", other: "# books" })

   // ↓ ↓ ↓ ↓ ↓ ↓
   /*i18n*/{
     id: '{value, plural, one {# book} other {# books }}',
     values: { param }
   }

Messages with custom IDs
------------------------

It's possible to use a custom message ID and generated messages as a default one.
In this case, ``t`` macro is called with a message ID and then used as a template tag:

.. code-block:: jsx

   import { t } from '@lingui/macro'

   // Macro
   t("msg.id")`Default message`

   // ↓ ↓ ↓ ↓ ↓ ↓
   /*i18n*/{
     id: "msg.id",
     defaults: "Default message"
   }

``plural`` and other formatters are called with a custom ID as a first argument, while
second argument is formatter parameters - value and message variants:

.. code-block:: jsx

   import { plural } from '@lingui/macro'

   // Macro
   plural("msg.plural", {
     value,
     one: "# book",
     other: "# books"
   })

   // ↓ ↓ ↓ ↓ ↓ ↓
   /*i18n*/{
     id: "msg.plural",
     defaults: '{value, plural, one {# book} other {# books }}',
     values: { param }
   }

Description
-----------

Another addition to API is message description, which is passed to translators and it
contains additional hints about the message. To add a message description, simply
prepend the message with a comment starting with ``i18n:``. Everything after is
considered as description.

The comment can be either a line comment:

.. code-block:: jsx

   import { t } from '@lingui/macro'

   // i18n: Greetings at homepage
   t`Greetings at homepage`

   // ↓ ↓ ↓ ↓ ↓ ↓
   /*i18n: Greetings at homepage*/{
     id: 'Hello {name}',
     values: { name }
   }

Or a block comment:

.. code-block:: jsx

   import { t } from '@lingui/macro'

   /*i18n: Greetings at homepage */t('message.hello')`Hello ${name}`

   // ↓ ↓ ↓ ↓ ↓ ↓
   /*i18n: Greetings at homepage*/{
     id: 'message.hello',
     defaults: 'Hello {name}',
     values: { name }
   }

Description for plurals and other formatters is the same:

.. code-block:: jsx

   import { plurals } from '@lingui/macro'

   // i18n: Number of books
   plural({
     value,
     one: "# book",
     other: "# books"
   })

   // ↓ ↓ ↓ ↓ ↓ ↓
   /*i18n: Number of books*/{
     id: '{value, plural, one {# book} other {# books }}',
     values: { param }
   }

Lazy translations
-----------------

Lazy translations are useful when we need to define a message, but translate it later.
This was previously achieved using ``i18Mark``. Now we can use the same macros,
but instead of passing message descriptor to ``i18n`` object, we pass it to ``i18n.lazy``
method:

.. code-block:: jsx

   import { setupI18n } from `@lingui/core`
   import { t } from `@lingui/macro`

   // Setup i18n and load messages
   const i18n = setupI18n()
   const msg = i18n.lazy(t`Default message`)

   // The translation is returned by simply calling the message:
   const translation = msg()

   // id attribute of translation function contains the reference to message ID
   msg.id === "Default message" // message ID

Multiple lazy translations can be defined using ``i18n.defineMessages``:

.. code-block:: jsx

   import { setupI18n } from `@lingui/core`
   import { t } from `@lingui/macro`

   // Setup i18n and load messages
   const i18n = setupI18n()

   const languages = i18n.defineMessages({
      en: t`English`,
      cs: t`Czech`,
      fr: t`French`,
   })

``i18n.defineMessages`` is just a shortcut for:

.. code-block:: jsx

   const languages = {
      en: i18n.lazy(t`English`),
      cs: i18n.lazy(t`Czech`),
      fr: i18n.lazy(t`French`),
   })

.. warning::

   ``i18n.defineMessages`` behaves differently than ``defineMessages`` in react-intl.
   ``i18n.defineMessages`` creates an object of lazy translations, while
   ``defineMessages`` creates message descriptors.

   If all you need is to create message descriptors, simply drop ``i18n.defineMessages``:

   .. code-block:: jsx

      // messages.js
      import { t } from `@lingui/macro`

      const languages = {
         en: t`English`,
         cs: t`Czech`,
         fr: t`French`,
      }

      // app.js
      // Later in the code we need to pass message descriptors to ``i18n`` object:
      import { setupI18n } from `@lingui/core`

      // Setup i18n and load messages
      const i18n = setupI18n()
      i18n(languages.en)

   Compare to this example using lazy translations with ``i18n.defineMessages``:

   .. code-block:: jsx

      // messages.js
      import { setupI18n } from `@lingui/core`
      import { t } from `@lingui/macro`

      const i18n = setupI18n()

      const languages = i18n.defineMessages({
         en: t`English`,
         cs: t`Czech`,
         fr: t`French`,
      })

      // app.js
      // Later in the code, simply call lazy message:
      languages.en()

      // If you need to access message ID, use ``id`` atribute:
      i18n(languages.en.id)

Lazy translations are usually defined in different scope than evaluated. Parameters
are therefore unknown, but we still need to know their names, so we can create placeholders
in MessageFormat. ``arg`` macro is used exactly for that:

.. code-block:: jsx

   // Macro
   const books = i18n.lazy(plural({
      value: arg('count'),
      one: '# book',
      other: '# books'
   }))

   const translation = books({ count: 42 })

Extracting messages
===================

Messages are extracted from code already transformed by macros. This makes macros
completely optional and extraction will work also with message descriptors created
manually.

Extract script will look for  a ``i18n`` comments:

.. code-block:: js

   /*i18n*/{
     id: 'Message'
   }

An object after such comment is considered as message descriptor and extracted.

Description of message can be optionally added in this comment:

.. code-block:: js

   /*i18n: Description*/{
     id: 'Message'
   }

.. note::

   Macros generate these comments automatically. It's necessary to write them manually
   only if we don't use macros at all or in case we want to add a message description.

Summary
=======

The API solves following issues:

- `#197 <https://github.com/lingui/js-lingui/issues/197>`_ - Add metadata to messages
- `#258 <https://github.com/lingui/js-lingui/issues/197>`_ - i18Mark should accept default value

``i18Mark`` will become obsolete by these macros.

Common catalogs
---------------

Feature request from #258, implemented using ``i18n.defineMessages``:

.. code-block:: jsx

   import { defineMessages } from `@lingui/macro`

   export default i18n.defineMessages({
      yes: t`Yes`,
      no: t`No`,
      cancel: t`Cancel`,
      confirmDelete: t`Do you really want to delete ${arg("filename")}?`
   })

Catalogs are type-checked by default:

.. code-block:: jsx

   import common from './common'

   console.log(common.confirmDelete({ filename: "common.js" }))

   // These examples would throw type error:
   // common.confrmDelete()  // unknown attribute `confrmDelete` (typo)
   // common.confirmDelete()  // missing first argument
   // common.confirmDelete({ flname: "common.js" })  // invalid object type (typo)

.. _Fluent: https://projectfluent.org/
