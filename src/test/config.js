import sinon from 'sinon'
import { inspect } from 'util'
import { test, afterEach } from 'tap'

// packages
import core from '@actions/core'
import config from '../lib/config.js'

afterEach(() => {
  sinon.restore()
})

test('default values', assert => {
  assert.plan(2)

  sinon.stub(core, 'info')

  const options = config({})

  // debug
  assert.ok(core.info.calledWith('no config file found'))
  assert.same(options, { dependents: [], additional: [], files: [] })
})

test('invalid config', assert => {
  assert.plan(2)

  sinon.stub(core, 'info')

  const options = config({ workspace: process.cwd(), path: '/test/fixtures/nonexistent.yml' })

  // debug
  assert.ok(core.info.calledWith('no config file found'))
  assert.same(options, { dependents: [], additional: [], files: [] })
})

test('config does not exist', assert => {
  assert.plan(2)

  sinon.stub(core, 'setFailed')
  sinon.stub(process, 'exit')

  config({ workspace: process.cwd(), path: '/test/fixtures/invalid.yml' })

  // debug
  assert.ok(core.setFailed.calledWith('failed to parse config'))
  assert.ok(process.exit.calledWith(1))
})

test('valid config', assert => {
  assert.plan(2)

  sinon.stub(core, 'debug')
  sinon.stub(core, 'setFailed')
  sinon.stub(process, 'exit')

  const options = config({ workspace: process.cwd(), path: '/test/fixtures/valid.yml' })

  // debug
  assert.ok(core.debug.calledWith(`config loaded: ${inspect(options)}`))

  // file was parsed correctly
  assert.same(options, {
    dependents: [
      'include*',
      '!exclude*'
    ],

    additional: [
      'additional-include*',
      '!additional-exclude-*'
    ],

    files: [
      'include-file',
      '!exclude-file'
    ]
  })
})
