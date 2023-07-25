// packages
import core from '@actions/core'
import github from '@actions/github'

export default async function (octokit, { repositories, localFiles }) {
  // lets store our results in a Map
  const changedRepositories = new Map()

  // iterate through the repos
  for (const repo of repositories) {
    // lets store our results in a Map
    const changedContent = new Map()

    // iterate through file paths
    for (const [path, localContent] of localFiles.entries()) {
      let remoteContent

      try {
        // fetch the content from the target repo to compare against it
        const { data: { content: encoded } } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
          owner: github.context.repo.owner,
          repo,
          path
        })

        // convert to a buffer
        remoteContent = Buffer.from(encoded, 'base64')
      } catch (err) {
        // exit early
        // TODO: distinguish between 404 and other errors
        // core.warning(`✖ ${repo}:${path} remote lookup failed`)
        // core.debug(`GET /repos/{owner}/${repo}/contents/${path} => ${err.message}`)
        // continue

        // indicate an empty file
        remoteContent = Buffer.from('')
      }

      // exit early if content is the same
      if (remoteContent && remoteContent.compare(localContent) === 0) {
        core.debug(`✅ ${repo}:${path} is up to date`)
        continue
      }

      changedContent.set(path, remoteContent)
    }

    if (changedContent.size > 0) {
      changedRepositories.set(repo, changedContent)
    }
  }

  return changedRepositories
}
