/* eslint-disable camelcase */

// node modules
import { inspect } from 'util'
import { readFile } from 'fs/promises'

// packages
import core from '@actions/core'
import github from '@actions/github'
import globby from 'globby'
import micromatch from 'micromatch'
import { createPatch } from 'diff'

// modules
import config from './config.js'
import repos from './repos.js'

const workspace = process.env.GITHUB_WORKSPACE || '/github/workspace'

const allowed = [
  'schedule',
  'workflow_dispatch',
  'repository_dispatch',
  'pull_request',
  'release',
  'workflow_run',
  'push'
]

export default async function ({ token, dry, config: path }) {
  if (dry) {
    core.info('running in dry-run mode')
  }

  if (!allowed.includes(github.context.eventName)) {
    core.warning(`action ran on incompatible event "${github.context.eventName}", only "${allowed.join('", "')}" are allowed`)
    process.exit(0)
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

  core.info(`found ${paths.length} files to sync`)
  if (paths.length > 0) core.debug(inspect(paths))

  const patches = []

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
        core.debug(`✔ ${repo}:${path} is up to date`)
        continue
      }

      // in pull request mode
      if (github.context.eventName === 'pull_request') {
        const before = content ? content.toString('utf8') : ''
        const after = contents.get(path).toString('utf8')

        const patch = createPatch(`${repo}:${path}`, before, after)

        patches.push(patch)
      } else {
        if (dry) {
          core.info(`⚠ ${repo}:${path} will be updated [dry-run]`)
          continue
        }

        // update the repo
        await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
          message: `chore(template): sync with ${github.context.repo.owner}/${github.context.repo.repo}`,
          content: contents.get(path).toString('base64'),
          owner: github.context.repo.owner,
          repo,
          path,
          sha
        })

        core.info(`✔ ${repo}:${path} is updated`)
      }
    }
  }

  // pull request mode
  if (github.context.eventName === 'pull_request') {
    const { payload: { pull_request } } = github.context

    const header = ['##### Template Repository Sync Report']

    let message

    if (patches.length === 0) {
      message = ['no changes to sync']
    } else {
      message = [
        `> Found ${patches.length} files to update`,
        '<details><summary>Show Diff</summary>',
        '',
        patches.map(patch => `\`\`\`diff\n${patch}\n\`\`\``).join('\n\n'),
        '',
        '</details>'
      ]
    }

    // update PR
    await octokit.issues.createComment({
      ...github.context.repo,
      issue_number: pull_request.number,
      body: header.concat(message).join('\n')
    })
  }
}
