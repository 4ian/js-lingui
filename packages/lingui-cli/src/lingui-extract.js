const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const Table = require('cli-table')
const emojify = require('node-emoji').emojify
const program = require('commander')
const transformFileSync = require('babel-core').transformFileSync
const getConfig = require('lingui-conf').default

const config = getConfig()

function extractMessages(files) {
  files.forEach(file => {
    if (!fs.existsSync(file)) return

    if (fs.lstatSync(file).isDirectory()) {
      const ignored = config.srcPathIgnorePatterns.filter(pattern => (new RegExp(pattern)).test(file))
      if (ignored.length) return

      extractMessages(
        fs.readdirSync(file).map(filename => path.join(file, filename))
      )
    } else {
      if (!/\.jsx?$/i.test(file)) return
      transformFileSync(file)
      console.log(chalk.green(file))
    }
  })
}

function collectMessages(dir) {
  const catalog = {}

  fs.readdirSync(dir)
    .map(filename => path.join(dir, filename))
    .forEach(filename => {
      let messages = {}
      if (fs.lstatSync(filename).isDirectory()) {
        messages = collectMessages(filename)
      } else {
        messages = JSON.parse(fs.readFileSync(filename))
      }
      Object.assign(catalog, messages)
    })

  return catalog
}

function writeCatalogs(localeDir) {
  const buildDir = path.join(localeDir, '_build')
  const catalog = collectMessages(buildDir)

  const languages = fs.readdirSync(localeDir).filter(dirname =>
    /^([a-z-]+)$/i.test(dirname) &&
    fs.lstatSync(path.join(localeDir, dirname)).isDirectory()
  )

  const stats =  languages.map(
    language => JSONWriter(catalog, path.join(localeDir, language))
  )
  return { languages, stats}
}

function JSONWriter(messages, languageDir) {
  let newFile = true

  const catalog = {}
  Object.keys(messages).forEach(key => catalog[key] = '')

  const catalogFilename = path.join(languageDir, 'messages.json')

  if (fs.existsSync(catalogFilename)) {
    const original = JSON.parse(fs.readFileSync(catalogFilename))
    Object.assign(catalog, original)
    newFile = false
  }

  const content = JSON.stringify(catalog, null, 2)
  fs.writeFileSync(catalogFilename, content)

  if (newFile) {
    console.log(chalk.green(`Merging ${catalogFilename}`))
  } else {
    console.log(chalk.yellow(`Writing ${catalogFilename}`))
  }

  return getStats(catalog)
}

function getStats(catalog) {
  return [
    Object.keys(catalog).length,
    Object.keys(catalog).map(key => catalog[key]).filter(msg => !msg).length
  ]
}

function displayStats(languages, stats) {
  const table = new Table({
    head: ['Language', 'Total count', 'Missing'],
    colAligns: ['left', 'middle', 'middle'],
    style: {
      head: ['green'],
      border: [],
      compact: true
    }
  })

  languages.forEach(
    (language, index) => table.push({[language]: stats[index]})
  )

  console.log(table.toString())
}


program.parse(process.argv)

console.log(emojify(':mag:  Extracting messages from source files:'))
extractMessages(program.args.length ? program.args : config.srcPathDirs)
console.log()

console.log(emojify(':book:  Writing message catalogues:'))
const { languages, stats} = writeCatalogs(config.localeDir)
console.log()

console.log(emojify(':chart_with_upwards_trend:  Catalog statistics:'))
displayStats(languages, stats)
console.log()

console.log(emojify(':sparkles:  Done!'))
