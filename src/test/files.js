import sinon from 'sinon'
import { join } from 'path'
import { test } from 'tap'

import { URL, fileURLToPath } from 'url'
const __dirname = fileURLToPath(new URL('.', import.meta.url))

// packages
import core from '@actions/core'
import files from '../lib/files.js'
import { inspect } from 'util'

sinon.stub(core, 'info')
sinon.stub(core, 'debug')

const workspace = join(__dirname, 'fixtures')

test('lists files', async assert => {
  assert.plan(3)

  const options = { files: [] }

  const contents = await files(workspace, options)

  assert.same(core.info.lastCall.args, ['found 2 files available to sync'])
  assert.same(core.debug.lastCall.args, [inspect(['invalid.yml', 'valid.yml'])])

  assert.equal(contents.size, 2)
})
