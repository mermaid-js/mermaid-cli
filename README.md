[![Join our Slack!](https://img.shields.io/static/v1?message=join%20chat&color=9cf&logo=slack&label=slack)](https://join.slack.com/t/mermaid-talk/shared_invite/enQtNzc4NDIyNzk4OTAyLWVhYjQxOTI2OTg4YmE1ZmJkY2Y4MTU3ODliYmIwOTY3NDJlYjA0YjIyZTdkMDMyZTUwOGI0NjEzYmEwODcwOTE) [![This project is using Percy.io for visual regression testing.](https://percy.io/static/images/percy-badge.svg)](https://percy.io/Mermaid/mermaid-cli) ![Build, test and deploy](https://github.com/mermaid-js/mermaid-cli/workflows/Build,%20test%20and%20deploy%20mermaid-cli%20Docker%20image/badge.svg)

This is a command-line interface (CLI) for [mermaid](https://mermaidjs.github.io/). It takes a mermaid definition file as input and generates svg/png/pdf file as output.

## Use Docker:
```docker pull minlag/mermaid-cli``` or e.g. ```docker pull minlag/mermaid-cli:8.8.0```
https://hub.docker.com/r/minlag/mermaid-cli

## Install locally
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
## Install globally
❗️ We do **NOT** recommend installing it globally because both YARN and NPM could fail to install a command line tool globally properly due to weird permission issues.
```
yarn global add @mermaid-js/mermaid-cli
```
 Or
```
npm install -g @mermaid-js/mermaid-cli
```
## Examples
```
mmdc -i input.mmd -o output.svg
```
Please run the following command to see the latest options:
```
mmdc -h
```
## Run with npx
[`npx`](https://www.npmjs.com/package/npx) is installed by default with NPM. It downloads and runs commands at the same time.
To use Mermaid CLI with npx, you need to use the `-p` flag because the package name is different than the command it installs (`mmdc`).
```
npx -p @mermaid-js/mermaid-cli mmdc -h
```
## Known issues
1. [Linux sandbox issue](docs/linux-sandbox-issue.md)


```
(node:8281) UnhandledPromiseRejectionWarning: Error: Failed to launch chrome!
[0416/092218.828861:ERROR:zygote_host_impl_linux.cc(88)] Running as root without --no-sandbox is not supported. See https://crbug.com/638180.

(node:8191) UnhandledPromiseRejectionWarning: Error: Failed to launch chrome!
[0416/091938.210735:FATAL:zygote_host_impl_linux.cc(124)] No usable sandbox! Update your kernel or see https://chromium.googlesource.com/chromium/src/+/master/docs/linux_suid_sandbox_development.md for more information on developing with the SUID sandbox. If you want to live dangerously and need an immediate workaround, you can try using --no-sandbox.
```

First and foremost, you should not run as root and you should upgrade your Linux kernel to latest version.

But if you don't want to follow the advice above and just want to disable sandbox, here you go:

Create a `puppeteer-config.json` file:

```json
{
  "args": ["--no-sandbox"]
}
```

And when you invoke `mmdc`:

```
mmdc -p puppeteer-config.json ...
```


## For contributors
Contributions are welome. See the [contribution guide](CONTRIBUTING.md).

