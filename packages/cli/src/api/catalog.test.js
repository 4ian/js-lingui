import fs from "fs"
import path from "path"
import tmp from "tmp"
import mockFs from "mock-fs"

import { mockConfig } from "@lingui/jest-mocks"
import configureCatalog from "./catalog"

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
function escapeRegExp(string) {
  // $& means the whole matched string
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

describe("Catalog API", function() {
  const createConfig = config =>
    mockConfig({
      localeDir: tmp.dirSync({ unsafeCleanup: true }).name,
      ...config
    })

  afterEach(() => {
    mockFs.restore()
  })

  describe("read", function() {
    it("should return null if file does not exist", function() {
      // mock empty filesystem
      mockFs()

      const config = createConfig({
        format: "po",
        localeDir: "."
      })
      const catalog = configureCatalog(config)

      const messages = catalog.read("en")
      expect(messages).toBeNull()
    })

    it("should read file in given format", function() {
      mockFs({
        en: {
          "messages.po": fs.readFileSync(
            path.resolve(__dirname, "formats/fixtures/messages.po")
          )
        }
      })
      const config = createConfig({
        format: "po",
        localeDir: "."
      })
      const catalog = configureCatalog(config)

      const messages = catalog.read("en")

      mockFs.restore()
      expect(messages).toMatchSnapshot()
    })

    it("should read file in previous format", function() {
      mockFs({
        en: {
          "messages.json": fs.readFileSync(
            path.resolve(__dirname, "formats/fixtures/messages.json")
          )
        }
      })
      const config = createConfig({
        format: "po",
        prevFormat: "minimal",
        localeDir: "."
      })
      const catalog = configureCatalog(config)

      const messages = catalog.read("en")

      mockFs.restore()
      expect(messages).toMatchSnapshot()
    })
  })

  it("readAll - should read existing catalogs for all locales", function() {
    const mockedPlugin = configureCatalog(createConfig())
    mockedPlugin.getLocales = jest.fn(() => ["en", "cs"])
    mockedPlugin.read = jest.fn(locale => ({
      "msg.header": { translation: `Message in locale ${locale}` }
    }))

    expect(mockedPlugin.readAll()).toEqual({
      en: {
        "msg.header": {
          translation: "Message in locale en"
        }
      },
      cs: {
        "msg.header": {
          translation: "Message in locale cs"
        }
      }
    })
  })

  /**
   * Convert JSON format to PO and then back to JSON.
   * - Compare that original and converted JSON file are identical
   * - Check the content of PO file
   */
  it("should convert catalog format", function() {
    mockFs({
      en: {
        "messages.json": fs.readFileSync(
          path.resolve(__dirname, "formats/fixtures/messages.json")
        ),
        "messages.po": mockFs.file()
      }
    })

    const fileContent = format =>
      fs
        .readFileSync("./en/messages." + (format === "po" ? "po" : "json"))
        .toString()
        .trim()

    const originalJson = fileContent("json")
    const po2json = configureCatalog(
      createConfig({
        format: "po",
        prevFormat: "minimal",
        localeDir: "."
      })
    )
    po2json.write("en", po2json.read("en"))
    const convertedPo = fileContent("po")

    const json2po = configureCatalog(
      createConfig({
        format: "minimal",
        prevFormat: "po",
        localeDir: "."
      })
    )
    json2po.write("en", json2po.read("en"))
    const convertedJson = fileContent("json")

    mockFs.restore()
    expect(originalJson).toEqual(convertedJson)
    expect(convertedPo).toMatchSnapshot()
  })

  describe("getLocale", function() {
    it("should get locale for given filename", function() {
      const config = createConfig()
      const catalog = configureCatalog(config)
      expect(catalog.getLocale(path.join("en", "messages.po"))).toEqual("en")
      expect(catalog.getLocale(path.join("en_US", "messages.po"))).toEqual(
        "en_US"
      )
      expect(catalog.getLocale(path.join("en-US", "messages.po"))).toEqual(
        "en-US"
      )
    })

    it("should return null for invalid locales", function() {
      const config = createConfig()
      const catalog = configureCatalog(config)
      expect(catalog.getLocale("messages.po")).toBeNull()
    })
  })

  describe("merge", function() {
    /*
    catalog.merge(prevCatalogs, nextCatalog)

    prevCatalogs - map of message catalogs in all available languages with translations
    nextCatalog - language-agnostic catalog with actual messages extracted from source

    Note: if a catalog in prevCatalogs is null it means the language is availabe, but
    no previous catalog was generated (usually first run).

    Orthogonal use-cases
    --------------------

    Message IDs:
    - auto-generated IDs: message is used as a key, `defaults` is not set
    - custom IDs: message is used as `defaults`, custom ID as a key

    Source locale (defined by `sourceLocale` in config):
    - catalog for `sourceLocale`: initially, `translation` is prefilled with `defaults`
      (for custom IDs) or `key` (for auto-generated IDs)
    - all other languages: translation is kept empty
    */

    it("should initialize catalog", function() {
      const prevCatalogs = { en: null, cs: null }
      const nextCatalog = {
        "custom.id": {
          defaults: "Message with custom ID"
        },
        "Message with <0>auto-generated</0> ID": {}
      }

      expect(
        configureCatalog(createConfig({ sourceLocale: "en" })).merge(
          prevCatalogs,
          nextCatalog
        )
      ).toEqual({
        // catalog for sourceLocale - translation is prefilled
        en: {
          "custom.id": {
            defaults: "Message with custom ID",
            translation: "Message with custom ID"
          },
          "Message with <0>auto-generated</0> ID": {
            translation: "Message with <0>auto-generated</0> ID"
          }
        },
        // catalog for other than sourceLocale - translation is empty
        cs: {
          "custom.id": {
            defaults: "Message with custom ID",
            translation: ""
          },
          "Message with <0>auto-generated</0> ID": {
            translation: ""
          }
        }
      })
    })

    it("should merge translations from existing catalogs", function() {
      const prevCatalogs = {
        en: {
          "custom.id": {
            defaults: "Message with custom ID",
            translation: "Message with custom ID"
          },
          "Message with <0>auto-generated</0> ID": {
            translation: "Message with <0>auto-generated</0> ID"
          }
        },
        cs: {
          "custom.id": {
            defaults: "Message with custom ID",
            translation: "Translation of message with custom ID"
          },
          "Message with <0>auto-generated</0> ID": {
            translation: "Translation of message with auto-generated ID"
          }
        }
      }

      const nextCatalog = {
        "custom.id": {
          defaults: "Message with custom ID, possibly changed"
        },
        "new.id": {
          defaults: "Completely new message"
        },
        "Message with <0>auto-generated</0> ID": {},
        "New message": {}
      }

      expect(
        configureCatalog(createConfig({ sourceLocale: "en" })).merge(
          prevCatalogs,
          nextCatalog
        )
      ).toEqual({
        en: {
          "custom.id": {
            defaults: "Message with custom ID, possibly changed",
            translation: "Message with custom ID, possibly changed"
          },
          "new.id": {
            defaults: "Completely new message",
            translation: "Completely new message"
          },
          "Message with <0>auto-generated</0> ID": {
            translation: "Message with <0>auto-generated</0> ID"
          },
          "New message": {
            translation: "New message"
          }
        },
        cs: {
          "custom.id": {
            defaults: "Message with custom ID, possibly changed",
            translation: "Translation of message with custom ID"
          },
          "new.id": {
            defaults: "Completely new message",
            translation: ""
          },
          "Message with <0>auto-generated</0> ID": {
            translation: "Translation of message with auto-generated ID"
          },
          "New message": {
            translation: ""
          }
        }
      })
    })

    it("should force overwrite of defaults", function() {
      const prevCatalogs = {
        en: {
          "custom.id": {
            defaults: "",
            translation: "Message with custom ID"
          }
        },
        cs: {
          "custom.id": {
            defaults: "",
            translation: "Translation of message with custom ID"
          }
        }
      }

      const nextCatalog = {
        "custom.id": {
          defaults: "Message with custom ID, possibly changed"
        }
      }

      // Without `overwrite`:
      // The translation of `custom.id` message for `sourceLocale` is kept intact
      expect(
        configureCatalog(createConfig({ sourceLocale: "en" })).merge(
          prevCatalogs,
          nextCatalog
        )
      ).toEqual({
        en: {
          "custom.id": {
            defaults: "Message with custom ID, possibly changed",
            translation: "Message with custom ID"
          }
        },
        cs: {
          "custom.id": {
            defaults: "Message with custom ID, possibly changed",
            translation: "Translation of message with custom ID"
          }
        }
      })

      // With `overwrite`
      // The translation of `custom.id` message for `sourceLocale` is changed
      expect(
        configureCatalog(createConfig({ sourceLocale: "en" })).merge(
          prevCatalogs,
          nextCatalog,
          { overwrite: true }
        )
      ).toEqual({
        en: {
          "custom.id": {
            defaults: "Message with custom ID, possibly changed",
            translation: "Message with custom ID, possibly changed"
          }
        },
        cs: {
          "custom.id": {
            defaults: "Message with custom ID, possibly changed",
            translation: "Translation of message with custom ID"
          }
        }
      })
    })

    it("should mark obsolete messages", function() {
      const prevCatalogs = {
        en: {
          "msg.hello": {
            translation: "Hello World"
          }
        }
      }
      const nextCatalog = {}
      expect(
        configureCatalog(createConfig()).merge(prevCatalogs, nextCatalog)
      ).toEqual({
        en: {
          "msg.hello": {
            translation: "Hello World",
            obsolete: true
          }
        }
      })
    })
  })
})
