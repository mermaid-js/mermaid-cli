# Contributing

[fork]: ../../fork
[pr]: /compare
[style]: https://standardjs.com/
[code-of-conduct]: CODE_OF_CONDUCT.md

Hi there! I'm thrilled that you'd like to contribute to this project. Your help is essential for keeping it great.

Please note that this project is released with a [Contributor Code of Conduct][code-of-conduct]. By participating in this project you agree to abide by its terms.

## Submitting a pull request

1. [Fork][fork] and clone the repository
2. Configure and install the dependencies: `npm install`
3. Create a new branch: `git checkout -b my-branch-name`. Make sure to give a good name to the branch. New features shall start with `feature/<branch name>`. Bug fixes shall start with `fix/<branch-name>`
4. Make your change, add tests, and make sure the tests still pass - including
   1. Unit tests (`npm test`)
   2. E2E tests (`npm run test:cli`)
5. Push to your fork and [submit a pull request][pr]
6. Give yourself a high five, and wait for your pull request to be reviewed and merged.

Here are a few things you can do that will increase the likelihood of your pull request is accepted:

- Follow the [style guide][style] which is using [standard][style]. Any linting errors should be shown when running `npm test`.
  - Some linting errors might be automatically fixed by `npm run lint-fix`.
- Write and update tests.
- Keep your change as focused as possible. If there are multiple changes you would like to make that are not dependent upon each other, submit them as separate pull requests.
- Write a [good commit message](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html).

Work in the Progress pull requests are also welcome to get feedback early on, or if there is something blocking you.

## Resources

- [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
- [Using Pull Requests](https://help.github.com/articles/about-pull-requests/)
- [GitHub Help](https://help.github.com)

