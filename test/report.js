import sinon from 'sinon'
import { inspect } from 'util'
import { test, afterEach } from 'tap'

// packages
import core from '@actions/core'
import github from '@actions/github'

// override context
github.context = { repo: { owner: 'ahmad' } }

// mocks and stubs
sinon.stub(core, 'debug')
sinon.stub(core, 'warning')

import report from '../src/lib/report.js'

test('generats report', async assert => {
  assert.plan(2)

  const changedRepositories = new Map([
    ['repo', new Map([
      ['/path/to/file.1', Buffer.from('remoteContent\n')],
      ['/path/to/file.2', Buffer.from('remoteContent\n')],
    ])]
  ])

  const localFiles = new Map([
    ['/path/to/file.1', Buffer.from('localContent\n')],
    ['/path/to/file.2', Buffer.from('localContent\n')]
  ])

  const { header, body } = report(changedRepositories, localFiles)

  assert.equal(header, '## Template Repository Sync Report')
  assert.equal(body, `## Template Repository Sync Report

> Found 2 files to update in 1 repositories

### [repo](/ahmad/repo)

<details><summary><code>/path/to/file.1</code></summary>

${'```'}diff
--- /path/to/file.1
+++ /path/to/file.1
@@ -1,1 +1,1 @@
-remoteContent
+localContent

${'```'}

</details>

<details><summary><code>/path/to/file.2</code></summary>

${'```'}diff
--- /path/to/file.2
+++ /path/to/file.2
@@ -1,1 +1,1 @@
-remoteContent
+localContent

${'```'}

</details>
`)
})
