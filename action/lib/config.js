// internals
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { inspect } from 'util'

// packages
import yaml from 'yaml'
import core from '@actions/core'

const initial = { dependents: [], additional: [], files: [] }

export default function ({ workspace, path }) {
  const configPath = join(workspace || '', path || '.github/template-sync.yml')

  if (!existsSync(configPath)) {
    core.info('no config file found')
    return initial
  }

  // parse .github/template-sync.yml
  try {
    let options = yaml.parse(readFileSync(configPath, 'utf8'))

    // set some defaults
    options = Object.assign(initial, options)

    core.debug(`config loaded: ${inspect(options)}`)
    return options
  } catch (err) {
    core.setFailed('failed to parse config')
    process.exit(1)
  }
}
