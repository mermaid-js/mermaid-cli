### This is a command-line interface (CLI) for [mermaid](https://mermaid-js.github.io/). It takes a mermaid definition file as input and generates svg/png/pdf file as output.

[![Join our Slack!](https://img.shields.io/static/v1?message=join%20chat&color=9cf&logo=slack&label=slack)](https://join.slack.com/t/mermaid-talk/shared_invite/enQtNzc4NDIyNzk4OTAyLWVhYjQxOTI2OTg4YmE1ZmJkY2Y4MTU3ODliYmIwOTY3NDJlYjA0YjIyZTdkMDMyZTUwOGI0NjEzYmEwODcwOTE) [![This project is using Percy.io for visual regression testing.](https://percy.io/static/images/percy-badge.svg)](https://percy.io/Mermaid/mermaid-cli) ![Build, test and deploy](https://github.com/mermaid-js/mermaid-cli/workflows/Build,%20test%20and%20deploy%20mermaid-cli%20Docker%20image/badge.svg)

### Use Docker:
```docker pull minlag/mermaid-cli``` or e.g. version 8.8.0 ```docker pull minlag/mermaid-cli:8.8.0```
### Install locally
Some people are [having issue](https://github.com/mermaidjs/mermaid.cli/issues/15) installing this tool globally. Installing it locally is an alternative solution:
```
yarn add @mermaid-js/mermaid-cli
./node_modules/.bin/mmdc -h
```
Or use NPM:
```
npm install @mermaid-js/mermaid-cli
./node_modules/.bin/mmdc -h
```
### Install globally
❗️ We do **NOT** recommend installing it globally because both YARN and NPM could fail to install a command line tool globally properly due to weird permission issues.
`yarn global add @mermaid-js/mermaid-cli` or `npm install -g @mermaid-js/mermaid-cli`
### Examples
To see the latest options, please run the following command: `mmdc -h`

To convert Mermaid mmd diagram to an svg file, run this command: `mmdc -i input.mmd -o output.svg`

#### Piping from stdin

You can also pipe input from stdin

```bash
# create_mermaid_output is an executable that sends mermaid output to stdout
create_mermaid_output | mmdc -o output.svg
```

```bash
cat << EOF | mmdc
sequenceDiagram
    participant Alice
    participant Bob
    Alice->>John: Hello John, how are you?
    loop Healthcheck
        John->>John: Fight against hypochondria
    end
    Note right of John: Rational thoughts <br/>prevail!
    John-->>Alice: Great!
    John->>Bob: How about you?
    Bob-->>John: Jolly good!
EOF
```

### Run with npx
[`npx`](https://www.npmjs.com/package/npx) is installed by default with NPM. It downloads and runs commands at the same time.
To use Mermaid CLI with npx, you need to use the `-p` flag because the package name is different than the command it installs (`mmdc`).
`npx -p @mermaid-js/mermaid-cli mmdc -h`
### Known issues
1. [Linux sandbox issue](docs/linux-sandbox-issue.md)
### For contributors
Contributions are welome. See the [contribution guide](CONTRIBUTING.md).
