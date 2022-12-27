import sinon from 'sinon'
import { test, afterEach } from 'tap'

// packages
import core from '@actions/core'
import github from '@actions/github'

import scan from '../src/lib/scan.js'

// override context
github.context = { repo: { owner: 'ahmad' } }

// mocks and stubs
sinon.stub(core, 'debug')
sinon.stub(core, 'warning')

const repositories = ['foo']
const localFiles = new Map([['/path/file', Buffer.from('localContent')]])

afterEach(() => {
  sinon.resetHistory()
})

test('happy path', async assert => {
  assert.plan(2)

  const octokit = {
    request: sinon.fake.resolves({ data: { content: Buffer.from('remoteContent').toString('base64') } })
  }

  const changedRepositories = await scan(octokit, { repositories, localFiles })

  assert.ok(octokit.request.calledWith(
    'GET /repos/{owner}/{repo}/contents/{path}',
    { owner: 'ahmad', repo: 'foo', path: '/path/file' }
  ))

  assert.same(changedRepositories, new Map([
    ['foo', new Map([['/path/file', Buffer.from('remoteContent')]])]
  ]))
})

test('remote files as the same', async assert => {
  assert.plan(2)

  const octokit = {
    request: sinon.fake.resolves({ data: { content: Buffer.from('localContent').toString('base64') } })
  }

  const changedRepositories = await scan(octokit, { repositories, localFiles })

  assert.ok(core.debug.calledWith('✔ foo:/path/file is up to date'))

  assert.equal(changedRepositories.size, 0)
})

test('remote file = 404', async assert => {
  assert.plan(2)

  const octokit = {
    request: sinon.fake.throws('errorMessage')
  }

  const changedRepositories = await scan(octokit, { repositories, localFiles })

  assert.same(changedRepositories, new Map([
    ['foo', new Map([['/path/file', Buffer.from('')]])]
  ]))

  assert.equal(changedRepositories.size, 1)
})

// test('remote file failed', async assert => {
//   assert.plan(3)

//   const octokit = {
//     request: sinon.fake.throws('errorMessage')
//   }

//   const changedRepositories = await scan(octokit, { repositories, localFiles })

//   assert.ok(core.debug.calledWith('GET /repos/{owner}/foo/contents//path/file => errorMessage'))
//   assert.ok(core.warning.calledWith('✖ foo:/path/file remote lookup failed'))

//   assert.equal(changedRepositories.size, 0)
// })
