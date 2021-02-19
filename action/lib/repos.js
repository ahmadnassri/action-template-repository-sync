/* eslint-disable camelcase */

// node modules
import { inspect } from 'util'

// packages
import core from '@actions/core'
import github from '@actions/github'
import micromatch from 'micromatch'

const mediaType = {
  previews: [
    'baptiste'
  ]
}

export default async function (octokit, options) {
  // construct this template repo full name
  const full_name = `${github.context.repo.owner}/${github.context.repo.repo}`

  // determine type
  const { data: { is_template, owner: { type } } } = await octokit.request('GET /repos/{owner}/{repo}', {
    ...github.context.repo,
    mediaType
  })

  // exit early
  if (!is_template) {
    core.warning('action executed on non template repository')
    process.exit(0)
  }

  const api = (type === 'User') ? 'GET /users/{username}/repos' : 'GET /orgs/{org}/repos'

  const all = await octokit.paginate(api, {
    username: github.context.repo.owner,
    org: github.context.repo.owner,
    per_page: 100,
    mediaType
  })

  const repositories = all.filter(repo => repo.archived === false) // only include non-archived repos

  core.debug(`repo owner type is "${type}" with ${repositories.length} repositories`)

  // find all repos that mark this template as their source
  let dependents = repositories
    .filter(repo => repo.template_repository && repo.template_repository.full_name === full_name)
    .map(repo => repo.name)

  // run filter
  if (options.dependents.length > 0) dependents = micromatch(dependents, options.dependents)

  core.info(`found ${dependents.length} repositories marked as dependents`)
  if (dependents.length > 0) core.debug(inspect(dependents))

  let additional = []

  // TODO run a schema validation for config
  if (options.additional.length > 0) {
    // create list of all repos
    additional = repositories.map(repo => repo.name)

    // any special ones to include?
    additional = micromatch(additional, options.additional)

    core.info(`found ${additional.length} repositories marked as additional`)
    if (additional.length > 0) core.debug(inspect(additional))
  }

  // combine them & remove duplicates
  const final = [...new Set([...dependents, ...additional])]

  core.info(`final list of repos includes ${final.length} repositories`)
  if (final.length > 0) core.debug(inspect(final))

  return final
}
