/* eslint-disable camelcase */

import { createPatch } from 'diff'
import github from '@actions/github'

export default async function (octokit, { changedRepositories, localFiles }) {
  const patches = []

  for (const [repo, remoteFiles] of changedRepositories.entries()) {
    for (const [path, remoteContent] of remoteFiles.entries()) {
      const before = remoteContent.toString('utf8')
      const after = localFiles.get(path).toString('utf8')

      const patch = createPatch(`${repo}:${path}`, before, after)

      patches.push(patch)
    }
  }

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
