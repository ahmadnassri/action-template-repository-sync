import { createPatch } from 'diff'
import github from '@actions/github'

const header = '## Template Repository Sync Report'

export default function (changedRepositories, localFiles) {
  const output = [header, '']

  if (changedRepositories.size === 0) {
    output.push('> no changes to sync')
  } else {
    const count = [...changedRepositories.values()].map(x => [...x.values()]).flat().length

    output.push(`> Found ${count} file${count > 1 ? 's' : ''} to update in ${changedRepositories.size} repositories`, '')

    for (const [repo, remoteFiles] of changedRepositories.entries()) {
      output.push(`### [${repo}](/${github.context.repo.owner}/${repo})`, '')

      for (const [path, remoteContent] of remoteFiles.entries()) {
        const before = remoteContent.toString('utf8')
        const after = localFiles.get(path).toString('utf8')

        const patch = createPatch(path, before, after)

        output.push(`<details><summary><code>${path}</code></summary>`, '')
        output.push('```diff', patch.split('\n').splice(2).join('\n'), '```', '')
        output.push('</details>', '')
      }
    }
  }

  const body = output.join('\n')

  return { header, body }
}
