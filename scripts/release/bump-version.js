const fs = require("fs")
const chalk = require("chalk")
const semver = require("semver")
const { execSync } = require("child_process")

const VERSION_FILE = "packages/version.txt"

const oldVersion = fs
  .readFileSync(VERSION_FILE)
  .toString()
  .trim()

if (!semver.valid(oldVersion)) {
  console.error(
    `Version ${oldVersion} isn't valid. Please fix ${VERSION_FILE} manually.`
  )
  process.exit(1)
}

const newVersion = semver.inc(oldVersion, "prerelease")

fs.writeFileSync(VERSION_FILE, newVersion)

execSync(`git add ${VERSION_FILE}`)
execSync(`git commit -m 'chore: Release version ${newVersion}'`)
execSync(`git tag v${newVersion}`)

console.log(chalk.green(`Bumped version to ${newVersion}`))
