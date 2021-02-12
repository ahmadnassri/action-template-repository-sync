/* eslint-disable camelcase */

// node modules
import { inspect } from 'util'
import { readFile } from 'fs/promises'

// packages
import core from '@actions/core'
import github from '@actions/github'
import globby from 'globby'
import micromatch from 'micromatch'

// modules
import config from './config.js'
import repos from './repos.js'

const workspace = process.env.GITHUB_WORKSPACE || '/github/workspace'

export default async function ({ token, dry, config: path }) {
  if (dry) {
    core.info('running in dry-run mode')
  }
  // init octokit
  const octokit = github.getOctokit(token)

  // load config
  const options = config({ workspace, path })

  // get dependant repos
  const repositories = await repos(octokit, options)

  if (repositories.length === 0) {
    core.info('no repositories to update')
    process.exit(0)
  }

  // get list of files in current workspace
  let paths = await globby(['**', ...options.files], { cwd: workspace, gitignore: true, dot: true })

  // ignore .git files!
  paths = micromatch(paths, ['!.git/**'])

  // lets store our files in a Map
  const contents = new Map()

  // iterate over files
  for (const path of paths) {
    // read file content
    const content = await readFile(path)

    // store as base64 encoded string
    contents.set(path, content)
  }

  core.debug(`found ${paths.length} files to sync`)
  if (paths.length > 0) core.debug(inspect(paths))

  // iterate through the repos
  for (const repo of repositories) {
    // iterate through files
    for (const path of paths) {
      let sha
      let content

      try {
        const { data } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
          owner: github.context.repo.owner,
          repo,
          path
        })

        sha = data.sha
        content = Buffer.from(data.content, 'base64')
      } catch (err) {
        core.debug(`GET /repos/{owner}/${repo}/contents/${path} => ${err.message}`)
      }

      // exit early
      if (content && content.compare(contents.get(path)) === 0) {
        core.info(`ℹ ${repo}:${path} is up to date`)
        continue
      }

      if (dry) {
        core.info(`[dry-run] ⚠ ${repo}:${path}`)
      } else {
      // update the repo
        await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
          message: `chore(template): sync with ${github.context.repo.owner}/${github.context.repo.repo}`,
          content: contents.get(path).toString('base64'),
          owner: github.context.repo.owner,
          repo,
          path,
          sha
        })

        core.info(`✔ ${repo}:${path}`)
      }
    }
  }
}
