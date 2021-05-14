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
  'pull_request_target',
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

  core.info(`found ${paths.length} files available to sync`)

  if (paths.length > 0) core.debug(inspect(paths))

  const patches = []

  // iterate through the repos
  for (const repo of repositories) {
    const newContent = []

    // iterate through files
    for (const path of paths) {
      let content

      try {
        // fetch the content from the target repo to compare against it
        const { data: { content: encoded } } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
          owner: github.context.repo.owner,
          repo,
          path
        })

        // convert to a buffer
        content = Buffer.from(encoded, 'base64')
      } catch (err) {
        core.debug(`GET /repos/{owner}/${repo}/contents/${path} => ${err.message}`)
      }

      // exit early if content is the same
      if (content && content.compare(contents.get(path)) === 0) {
        core.debug(`✔ ${repo}:${path} is up to date`)
        continue
      }

      // check if in pull request mode
      if (['pull_request', 'pull_request_target'].includes(github.context.eventName)) {
        const before = content ? content.toString('utf8') : ''
        const after = contents.get(path).toString('utf8')

        const patch = createPatch(`${repo}:${path}`, before, after)

        patches.push(patch)
      } else {
        if (dry) {
          core.info(`⚠ ${repo}:${path} will be updated [dry-run]`)
          continue
        }

        // add file to update tree
        newContent.push({
          path,
          content: contents.get(path).toString('base64'),
          mode: '100644' // TODO fetch current file mode
        })

        core.info(`⚠ ${repo}:${path} will be updated`)
      }
    }

    if (newContent) {
      // get the default branch
      const { data: { default_branch } } = await octokit.request('GET /repos/{owner}/{repo}', {
        owner: github.context.repo.owner,
        repo
      })

      core.debug(`${repo}: default branch: ${default_branch}`)

      // Grab the latest commit
      const { data: [{ sha, commit: { tree } }] } = await octokit.request('GET /repos/{owner}/{repo}/commits?per_page=1', {
        owner: github.context.repo.owner,
        repo
      })

      core.debug(`${repo}: latest commit: { sha: ${sha}, tree.sha: ${tree.sha} }`)

      // Make a new tree for the deltas
      const { data: newTree } = await octokit.request('POST /repos/{owner}/{repo}/git/trees', {
        owner: github.context.repo.owner,
        repo,
        base_tree: tree.sha,
        tree: newContent
      })

      core.debug(`${repo}: new tree: ${newTree.sha}`)
      core.debug(inspect(newTree))

      // Make a new commit with the delta tree
      const { data: newCommit } = await octokit.request('POST /repos/{owner}/{repo}/git/commits', {
        owner: github.context.repo.owner,
        repo,
        message: `chore(template): sync with ${github.context.repo.owner}/${github.context.repo.repo}`,
        tree: newTree.sha,
        parents: [sha]
      })

      core.debug(`${repo}: new commit: ${newCommit.sha}`)
      core.debug(inspect(newCommit))

      // Set HEAD of default branch to the new commit
      await octokit.request('PATCH /repos/{owner}/{repo}/git/refs/{ref}', {
        owner: github.context.repo.owner,
        repo,
        ref: `heads/${default_branch}`,
        sha: newCommit.sha
      })

      core.info(`✔ ${repo} is updated`)
    }
  }

  // pull request mode
  if (['pull_request', 'pull_request_target'].includes(github.context.eventName)) {
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
