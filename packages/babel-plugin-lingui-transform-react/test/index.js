import fs from 'fs'
import glob from 'glob'
import path from 'path'
import { transformFileSync, transform } from 'babel-core'

import plugin from '../src/index'

function getTestName(testPath) {
  return path.basename(testPath)
}

describe('babel-plugin-lingui-transform-react', function () {
  const babelOptions = {
    plugins: [
      'external-helpers',
      'syntax-jsx',
      'transform-remove-strict-mode',
      plugin
    ]
  }

  const transformCode = (code) => () => transform(code, babelOptions)

  glob.sync(path.join(__dirname, 'fixtures/*/')).forEach(testPath => {
    const testName = getTestName(testPath)
    const actualPath = path.relative(process.cwd(), path.join(testPath, 'actual.js'))
    const expectedPath = path.join(testPath, 'expected.js')

    it(testName, () => {
      const expected = fs.readFileSync(expectedPath, 'utf8')
      const actual = transformFileSync(actualPath, babelOptions).code.trim()

      expect(actual).toEqual(expected.trim())
    })
  })

  describe('validation', function () {
    describe('Plural/Select/SelectOrdinal', function () {
      it('value must be a variable', function () {
        const code = `<Plural value="42" one="Book" other="Books" />`
        expect(transformCode(code)).toThrowErrorMatchingSnapshot()
      })

      it('value is missing', function () {
        const code = `<Plural one="Book" other="Books" />`
        expect(transformCode(code)).toThrowErrorMatchingSnapshot()
      })

      it('offset must be number or string, not variable', function () {
        const code = `<Plural value={value} offset={offset} one="Book" other="Books" />`
        expect(transformCode(code)).toThrowErrorMatchingSnapshot()
      })

      it('plural forms are missing', function () {
        const plural = `<Plural value={value} />`
        expect(transformCode(plural)).toThrowErrorMatchingSnapshot()

        const select = `<Select value={value} />`
        expect(transformCode(select)).toThrowErrorMatchingSnapshot()

        const ordinal = `<SelectOrdinal value={value} />`
        expect(transformCode(ordinal)).toThrowErrorMatchingSnapshot()
      })

      it('plural forms missing fallback', function () {
        const plural = `<Plural value={value} one="Book" />`
        expect(transformCode(plural)).toThrowErrorMatchingSnapshot()

        const select = `<Select value={value} one="Book" />`
        expect(transformCode(select)).toThrowErrorMatchingSnapshot()

        const ordinal = `<SelectOrdinal value={value} one="Book" />`
        expect(transformCode(ordinal)).toThrowErrorMatchingSnapshot()
      })

      it('plural rules must be valid', function () {
        const plural = `<Plural value={value} three="Invalid" one="Book" other="Books" />`
        expect(transformCode(plural)).toThrowErrorMatchingSnapshot()

        const ordinal = `<SelectOrdinal value={value} three="Invalid" one="st" other="rd" />`
        expect(transformCode(ordinal)).toThrowErrorMatchingSnapshot()
      })
    })

    describe('Date/Number', function () {
      it('value must be a variable', function () {
        expect(transformCode('<NumberFormat />')).toThrowErrorMatchingSnapshot()
        expect(transformCode('<NumberFormat value="42" />')).toThrowErrorMatchingSnapshot()
      })

      it('format must be string, variable or object with custom format', function () {
        expect(transformCode('<NumberFormat value={value} format="custom" />')).not.toThrow()
        expect(transformCode('<NumberFormat value={value} format={"custom"} />')).not.toThrow()
        expect(transformCode('<NumberFormat value={value} format={custom} />')).not.toThrow()
        expect(transformCode('<NumberFormat value={value} format={{ digits: 4 }} />')).not.toThrow()
        expect(transformCode('<NumberFormat value={value} format={42} />')).toThrowErrorMatchingSnapshot()
      })

      it('value must be a variable', function () {
        expect(transformCode('<DateFormat />')).toThrowErrorMatchingSnapshot()
        expect(transformCode('<DateFormat value="42" />')).toThrowErrorMatchingSnapshot()
      })
    })
  })
})
