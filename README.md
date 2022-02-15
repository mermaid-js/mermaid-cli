# mermaid-cli

This is a command-line interface (CLI) for [mermaid](https://mermaid-js.github.io/). It takes a mermaid definition file as input and generates an svg/png/pdf file as output.

[![Join our Slack!](https://img.shields.io/static/v1?message=join%20chat&color=9cf&logo=slack&label=slack)](https://join.slack.com/t/mermaid-talk/shared_invite/enQtNzc4NDIyNzk4OTAyLWVhYjQxOTI2OTg4YmE1ZmJkY2Y4MTU3ODliYmIwOTY3NDJlYjA0YjIyZTdkMDMyZTUwOGI0NjEzYmEwODcwOTE) [![This project is using Percy.io for visual regression testing.](https://percy.io/static/images/percy-badge.svg)](https://percy.io/Mermaid/mermaid-cli) ![Build, test and deploy](https://github.com/mermaid-js/mermaid-cli/workflows/Build,%20test%20and%20deploy%20mermaid-cli%20Docker%20image/badge.svg)

## Example Usage

Locate how to call the mmdc executable for your preferred method i.e. Docker,
Yarn, NPM, global install, etc. Try these examples to get started quickly.

### Convert Mermaid mmd Diagram File To SVG

```sh
mmdc -i input.mmd -o output.svg
```

### Create A PNG With A Dark Theme And Transparent Background

```sh
mmdc -i input.mmd -o output.png -t dark -b transparent
```

### Transform a markdown file with mermaid diagrams

```sh
mmdc -i readme.template.md -o readme.md
```

This command transforms a markdown file itself. The mermaid-cli will find the mermaid diagrams, create SVG files from them and refer to those in the markdown output.

This:

~~~md
### Some markdown
```mermaid
graph
   [....]
```

### Some more markdown
```mermaid
sequenceDiagram
   [....]
```
~~~

Becomes:

```md
### Some markdown
![diagram](./readme-1.svg)

### Some more markdown
![diagram](./readme-2.svg)
```

### Piping from stdin

You can easily pipe input from stdin. This example shows how to use a heredoc to
send a diagram as stdin to mermaid-cli (mmdc).

```sh
cat << EOF  | mmdc
    graph TD
    A[Client] --> B[Load Balancer]
EOF
```

### See All Available Options

```sh
mmdc -h
```

## Use Docker:

```sh
docker pull minlag/mermaid-cli
```

or e.g. version 8.8.0

```sh
docker pull minlag/mermaid-cli:8.8.0
```

The container looks for input files in `/data`. So for example, if you have a
diagram defined on your system in `/path/to/diagrams/diagram.mmd`, you can use
the container to generate an SVG file as follows:

```sh
docker run -it -v /path/to/diagrams:/data minlag/mermaid-cli -i /data/diagram.mmd
```

## Install locally

Some people are [having issues](https://github.com/mermaidjs/mermaid.cli/issues/15)
installing this tool globally. Installing it locally is an alternative solution:

```
yarn add @mermaid-js/mermaid-cli
./node_modules/.bin/mmdc -h
```

Or use NPM:

```
npm install @mermaid-js/mermaid-cli
./node_modules/.bin/mmdc -h
```

## Install globally

❗️ We do **NOT** recommend installing it globally because both YARN and NPM
could fail to install a command-line tool globally properly due to weird
permission issues.
`yarn global add @mermaid-js/mermaid-cli` or `npm install -g @mermaid-js/mermaid-cli`

## Install with [brew](https://brew.sh)

```
brew install mermaid-cli
```

### Run with npx

[`npx`](https://www.npmjs.com/package/npx) is installed by default with NPM. It
downloads and runs commands at the same time.  To use Mermaid CLI with npx, you
need to use the `-p` flag because the package name is different than the command
it installs (`mmdc`).  `npx -p @mermaid-js/mermaid-cli mmdc -h`

## Known issues

1. [Linux sandbox issue](docs/linux-sandbox-issue.md)
2. [Docker permission denied issue](docs/docker-permission-denied.md)

## For contributors

Contributions are welcome. See the [contribution guide](CONTRIBUTING.md).
