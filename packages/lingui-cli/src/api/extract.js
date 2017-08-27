import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import R from 'ramda'

import * as extractors from './extractors'

export function extract (src, options = {}) {
  const {
    localeDir,
    ignore = [],
    verbose = false
  } = options
  const ignorePatterns = ignore.map(pattern => new RegExp(pattern, 'i'))

  src.forEach(srcFilename => {
    if (
      !fs.existsSync(srcFilename) ||
      ignorePatterns.some(regexp => regexp.test(srcFilename))
    ) return

    if (fs.lstatSync(srcFilename).isDirectory()) {
      const subdirs = fs.readdirSync(srcFilename)
        .map(filename => path.join(srcFilename, filename))

      extract(subdirs, options)
      return
    }

    const extracted = Object.values(extractors).some(extractor => {
      if (!extractor.match(srcFilename)) return false
      extractor.extract(srcFilename, localeDir)
      return true
    })

    if (extracted && verbose) console.log(chalk.green(srcFilename))
  })
}

export function collect (buildDir) {
  return fs.readdirSync(buildDir)
    .map(filename => {
      const filepath = path.join(buildDir, filename)

      if (fs.lstatSync(filepath).isDirectory()) {
        return collect(filepath)
      }

      if (!filename.endsWith('.json')) return

      try {
        return JSON.parse(fs.readFileSync(filepath))
      } catch (e) {
        return {}
      }
    })
    .filter(Boolean)
    .reduce((catalog, messages) => {
      const mergeMessage = (msgId, prev, next) => ({
        ...next,
        origin: R.concat(prev.origin, next.origin)
      })
      return R.mergeWithKey(mergeMessage, catalog, messages)
    }, {})
}
