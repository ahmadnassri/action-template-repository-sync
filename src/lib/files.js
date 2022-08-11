// node modules
import { join } from 'path'
import { inspect } from 'util'
import { readFile } from 'fs/promises'

// packages
import globby from 'globby'
import micromatch from 'micromatch'
import core from '@actions/core'

export default async function (workspace, options) {
  // get list of files in current workspace
  let paths = await globby(['**', ...options.files], { cwd: workspace, gitignore: true, dot: true })

  // ignore .git files!
  paths = micromatch(paths, ['!.git/**'])

  // lets store our files in a Map
  const contents = new Map()

  // iterate over files
  for (const path of paths) {
    // read file content
    const content = await readFile(join(workspace, path))

    // store as base64 encoded string
    contents.set(path, content)
  }

  core.info(`found ${paths.length} files available to sync`)

  /* istanbul ignore next */
  if (paths.length > 0) core.debug(inspect(paths))

  return contents
}
