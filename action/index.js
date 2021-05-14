// packages
import core from '@actions/core'

// modules
import main from './lib/index.js'

// parse inputs
const inputs = {
  token: core.getInput('github-token', { required: true }),
  config: core.getInput('config', { required: false }),
  dry: core.getInput('dry-run', { required: false }) === 'true'
}

// error handler
function errorHandler (error) {
  core.setFailed(`${error.message}`)
  core.debug(error)
  process.exit(1)
}

// catch errors and exit
process.on('unhandledRejection', errorHandler)
process.on('uncaughtException', errorHandler)

await main(inputs)
