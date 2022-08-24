/* eslint-disable camelcase */

import { createPatch } from 'diff'
import github from '@actions/github'

export default async function (octokit, { changedRepositories, localFiles }) {
  const output = ['## Template Repository Sync Report']

  if (changedRepositories.size === 0) {
    output.push('> no changes to sync')
  } else {
    const count = [...changedRepositories.values()].map(x => [...x.values()]).flat().length

    output.push(`> Found ${count} files to update in ${changedRepositories.size} repositories`, '')

    for (const [repo, remoteFiles] of changedRepositories.entries()) {
      output.push(`<details><summary>${repo}</summary>`, '')

      for (const [path, remoteContent] of remoteFiles.entries()) {
        const before = remoteContent.toString('utf8')
        const after = localFiles.get(path).toString('utf8')

        const patch = createPatch(path, before, after)

        output.push('```diff', patch, '```', '', '')
      }

      output.push('</details>', '')
    }
  }

  const body = output.join('\n')
  const { issue: { number: issue_number } } = github.context

  // retrieve existing comments for the PR
  const { data: comments } = await octokit.rest.issues.listComments({ ...github.context.repo, issue_number })

  // find existing comment
  const old = comments.find(comment => comment.body.includes('## Template Repository Sync Report'))

  // update PR
  if (old) {
    await octokit.rest.issues.updateComment({ ...github.context.repo, comment_id: old.id, body })
  } else {
    await octokit.rest.issues.createComment({ ...github.context.repo, issue_number, body })
  }
}
