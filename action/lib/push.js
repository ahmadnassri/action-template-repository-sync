/* eslint-disable camelcase */

import { inspect } from 'util'

import core from '@actions/core'
import github from '@actions/github'

export default async function (octokit, { changedRepositories, localFiles, inputs }) {
  const newContent = []

  for (const [repo, remoteFiles] of changedRepositories.entries()) {
    for (const path of remoteFiles.keys()) {
      // add file to update tree
      newContent.push({
        path,
        content: localFiles.get(path).toString(),
        mode: '100644' // TODO fetch current file mode
      })

      core.info(`⚠ ${repo}:${path} will be updated`)
    }

    // dry run
    if (inputs.dry) continue

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
