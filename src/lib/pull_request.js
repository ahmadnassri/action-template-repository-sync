/* eslint-disable camelcase */

import { createPatch } from 'diff'
import github from '@actions/github'

export default async function (octokit, { changedRepositories, localFiles }) {
  const body = ['##### Template Repository Sync Report']

  if (changedRepositories.size === 0) {
    body.push('> no changes to sync')
  } else {
    const count = [...changedRepositories.values()].map(x => [...x.values()]).flat().length

    body.push(`> Found ${count} files to update in ${changedRepositories.size} repositories`, '')

    for (const [repo, remoteFiles] of changedRepositories.entries()) {
      body.push(`<details><summary>${repo}</summary>`, '')

      for (const [path, remoteContent] of remoteFiles.entries()) {
        const before = remoteContent.toString('utf8')
        const after = localFiles.get(path).toString('utf8')

        const patch = createPatch(path, before, after)

        body.push('```diff', patch, '```', '', '')
      }

      body.push('</details>', '')
    }
  }

  const { payload: { pull_request } } = github.context
  // update PR
  await octokit.rest.issues.createComment({
    ...github.context.repo,
    issue_number: pull_request.number,
    body: body.join('\n')
  })
}
