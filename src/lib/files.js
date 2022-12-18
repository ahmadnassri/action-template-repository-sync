// node modules
import { join } from 'path'
import { inspect } from 'util'
import { readFile } from 'fs/promises'

// packages
import { globby } from 'globby'
import micromatch from 'micromatch'
import core from '@actions/core'

export default async function (workspace, options) {
  // convert list of files to entries array
  const filesEntries = options.files.map(item => typeof item === 'string' ? [item, item] : Object.entries(item).pop())

  // convert entries array to an object
  const filesObject = Object.fromEntries(filesEntries)

  // get list of files in current workspace
  let paths = await globby(['**', ...Object.keys(filesObject)], { cwd: workspace, gitignore: true, dot: true })

  // ignore .git files!
  paths = micromatch(paths, ['!.git/**'])

  // lets store our files in a Map
  const contents = new Map()

  const finalPaths = []

  // iterate over files
  for (const path of paths) {
    // read file content
    const content = await readFile(join(workspace, path))

    // set new path (if any)
    const newPath = filesObject[path] || path

    finalPaths.push(newPath)

    // store as base64 encoded string
    contents.set(newPath, content)
  }

  core.info(`found ${paths.length} files available to sync`)

  /* istanbul ignore next */
  if (paths.length > 0) core.debug(inspect(finalPaths))

  return contents
}
