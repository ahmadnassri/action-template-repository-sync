/* eslint-disable camelcase */

import github from '@actions/github'
import report from './report.js'

export default async function (octokit, { changedRepositories, localFiles }) {
  const { header, body } = report(changedRepositories, localFiles)

  const { issue: { number: issue_number } } = github.context

  // retrieve existing comments for the PR
  const { data: comments } = await octokit.rest.issues.listComments({ ...github.context.repo, issue_number })

  // find existing comment
  const old = comments.find(comment => comment.body.includes(header))

  // update PR
  if (old) {
    await octokit.rest.issues.updateComment({ ...github.context.repo, comment_id: old.id, body })
  } else {
    await octokit.rest.issues.createComment({ ...github.context.repo, issue_number, body })
  }
}
