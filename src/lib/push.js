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

      core.info(`⚠️ ${repo}:${path} will be updated`)
    }

    // dry run
    if (inputs.dry === 'true') continue

    let default_branch, sha, tree, newTree, newCommit

    // get the default branch
    try {
      ({ data: { default_branch } } = await octokit.request('GET /repos/{owner}/{repo}', {
        owner: github.context.repo.owner,
        repo
      }))
    } catch (err) {
      core.warning(`❌ failed to detect default branch for ${repo}: ${err.response?.data?.message || err.message}`)
      continue
    }

    core.debug(`${repo}: default branch: ${default_branch}`)

    // Grab the latest commit
    try {
      ({ data: [{ sha, commit: { tree } }] } = await octokit.request('GET /repos/{owner}/{repo}/commits?per_page=1', {
        owner: github.context.repo.owner,
        repo
      }))
    } catch (err) {
      core.warning(`❌ failed to fetch commit info for ${repo}: ${err.response?.data?.message || err.message}`)
      continue
    }

    core.debug(`${repo}: latest commit: { sha: ${sha}, tree.sha: ${tree.sha} }`)

    // Make a new tree for the deltas
    try {
      ({ data: newTree } = await octokit.request('POST /repos/{owner}/{repo}/git/trees', {
        owner: github.context.repo.owner,
        repo,
        base_tree: tree.sha,
        tree: newContent
      }))
    } catch (err) {
      core.warning(`❌ failed to create a tree in ${repo}:${tree.sha} ${err.response?.data?.message || err.message}`)
      continue
    }

    core.debug(`${repo}: new tree: ${newTree.sha}`)
    core.debug(inspect(newTree))

    const prefix = inputs.commitPrefix || 'chore(template): sync with'
    const suffix = inputs.commitSuffix || ''
    let commitMessage = `${prefix} ${github.context.repo.owner}/${github.context.repo.repo}`
    if (suffix) {
      commitMessage += ` ${suffix}`
    }
    if (inputs.skipCi === 'true') {
      commitMessage += ' [skip ci]'
    }

    // Make a new commit with the delta tree
    try {
      ({ data: newCommit } = await octokit.request('POST /repos/{owner}/{repo}/git/commits', {
        owner: github.context.repo.owner,
        repo,
        message: commitMessage,
        tree: newTree.sha,
        parents: [sha]
      }))
    } catch (err) {
      core.warning(`❌ failed to create a new commit in ${repo}: ${err.response?.data?.message || err.message}`)
      continue
    }

    core.debug(`${repo}: new commit: ${newCommit.sha}`)
    core.debug(inspect(newCommit))

    // Set HEAD of default branch to the new commit
    try {
      await octokit.request('PATCH /repos/{owner}/{repo}/git/refs/{ref}', {
        owner: github.context.repo.owner,
        repo,
        ref: `heads/${default_branch}`,
        sha: newCommit.sha
      })
    } catch (err) {
      core.warning(`❌ failed to update brach head in ${repo}: ${err.response?.data?.message || err.message}`)
      continue
    }

    core.info(`✅ ${repo} is updated`)
  }
}
