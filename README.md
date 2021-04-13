# GitHub Action: Template Repository Sync

Keep projects in sync with the template repository they came from

[![license][license-img]][license-url]
[![release][release-img]][release-url]
[![super linter][super-linter-img]][super-linter-url]
[![test][test-img]][test-url]
[![semantic][semantic-img]][semantic-url]

<details>
  <summary><strong>Why?</strong></summary>

The [Template Repository](https://docs.github.com/en/github/creating-cloning-and-archiving-repositories/creating-a-template-repository) feature is a great way to accelerate creation of new projects.

However, after you "use" the template for first time, the two repositories will forever be out of sync *(any changes made to the template repository will not be reflected in the project repository)*

</details>

## Usage

This action will **automatically** detect all repositories within your account *(user or org)* that has been "initialized" from the template repository *(referred to as "dependents" in this doc)*

> :fire: **NOTE** There is currently a [bug in the GitHub APIs](https://github.com/github/docs/issues/4894) preventing this action from automatically detecting dependent repositories, until this is tis resolved, please use `additional` property in the config file to manually include repositories you want to sync

###### `.github/workflows/template-sync.yml`

``` yaml
on: [push, pull_request]

jobs:
  template-sync:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2 # important!
      - uses: ahmadnassri/action-template-repository-sync@v1
        with:
          github-token: ${{ secrets.GH_TOKEN }}
          dry-run: true
```

<details>
  <summary><em>A more practical example</em></summary>

``` yaml
name: template-sync

on:
  pull_request: # run on pull requests to preview changes before applying

  workflow_run: # setup this workflow as a dependency of others
    workflows: [ test, release ] # don't sync template unless tests and other important workflows have passed

jobs:
  template-sync:
    timeout-minutes: 20

    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2
      - uses: ahmadnassri/action-workflow-run-wait@v1 # wait for workflow_run to be successful
      - uses: ahmadnassri/action-workflow-queue@v1 # avoid conflicts, by running this template one at a time
      - uses: ahmadnassri/action-template-repository-sync@v1
        with:
          github-token: ${{ secrets.GH_TOKEN }}
```

</details>

> :warning: **HIGHLY RECOMMEND** to set `dry-run: true` for the first time you use this action, inspect the output to confirm if the affected repositories list is what you wanted to commit files to

###### `.github/template-sync.yml`

``` yaml
dependents:
  - "api-*" # include
  - "!lib-*" # exclude

additional:
  - "another-one-*" # include
  - "!not-this-*" # exclude

files:
  - ".gitignore"  # include
  - "!package.json" # exclude
  - "!(package-lock.json|yarn.lock)"

   # you probably want to exclude these files:
  - "!.github/workflows/template-sync.yml"
  - "!.github/template-sync.yml"
```

### Config File

###### `dependents`

a list of repository name patterns

> when not present or empty, the action will update **EVERY DEPENDENT** repository

###### `additional`

a list of repository name patterns

> expands the list of repos **in addition to the detected dependant repos**, use this to sync repos that were not originally initialized from the template repository.

###### `files`

a list of file name patterns to include or exclude

#### Pattern syntax

> :warning: Always use forward-slashes in glob expressions and backslashes for escaping characters.
> :book: This package uses a [`micromatch`](https://github.com/micromatch/micromatch) as a library for pattern matching.

### Inputs

| input          | required | default                     | description                                  |
|----------------|----------|-----------------------------|----------------------------------------------|
| `github-token` | ✔️       | `-`                         | The GitHub token used to call the GitHub API |
| `config`       | ❌        | `.github/template-sync.yml` | path to config file                          |
| `dry-run`      | ❌        | `false`                     | toggle info mode (commits wont occur)        |

## :warning: Operational Logic

-   The action will only run on the following event types: 'schedule`, `workflow\_dispatch`, `repository\_dispatch`, `pull\_request`, `release`, `workflow\_run`, `push\`.
-   The when run in `pull_request`, the action will post post a comment on the the Pull Request with the diff view of files to be changed.
-   The action will look for files under the `GITHUB_WORKSPACE` environment path
-   The action will read file contents **AT RUN TIME** *(so you can run build steps or modify content before running the action if you so wish)*
-   If no config file is present indicating which files to filter, the action will sync **ALL FILES** in the template repository
-   The action will respect **`.gitignore`** files
-   Files on target repos **WILL BE CREATED** if they do not exist

----
> Author: [Ahmad Nassri](https://www.ahmadnassri.com/) &bull;
> Twitter: [@AhmadNassri](https://twitter.com/AhmadNassri)

[license-url]: LICENSE
[license-img]: https://badgen.net/github/license/ahmadnassri/action-template-repository-sync

[release-url]: https://github.com/ahmadnassri/action-template-repository-sync/releases
[release-img]: https://badgen.net/github/release/ahmadnassri/action-template-repository-sync

[super-linter-url]: https://github.com/ahmadnassri/action-template-repository-sync/actions?query=workflow%3Asuper-linter
[super-linter-img]: https://github.com/ahmadnassri/action-template-repository-sync/workflows/super-linter/badge.svg

[test-url]: https://github.com/ahmadnassri/action-template-repository-sync/actions?query=workflow%3Atest
[test-img]: https://github.com/ahmadnassri/action-template-repository-sync/workflows/test/badge.svg

[semantic-url]: https://github.com/ahmadnassri/action-template-repository-sync/actions?query=workflow%3Arelease
[semantic-img]: https://badgen.net/badge/📦/semantically%20released/blue
