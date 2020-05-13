![Join our Slack!](https://img.shields.io/static/v1?message=join%20chat&color=9cf&logo=slack&label=slack)

# Contributors are welome

If you want to speed up the progress for mermaid-cli, join the slack channel and contact knsv.

# mermaid.cli

Command-line interface for [mermaid](https://mermaidjs.github.io/).

This CLI tool takes a mermaid definition file as input and generates svg/png/pdf file as output.


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

```
mmdc -i input.mmd -o output.png
```

```
mmdc -i input.mmd -o output.pdf
```

```
mmdc -i input.mmd -o output.svg -w 1024 -H 768
```

```
mmdc -i input.mmd -t forest
```

```
mmdc -i input.mmd -o output.png -b '#FFF000'
```

```
mmdc -i input.mmd -o output.png -b transparent
```


## Options

Please run the following command to see the latest options:

```
mmdc -h
```

The following is for your quick reference (may not be the latest version):

```
Usage: mmdc [options]


  Options:

    -V, --version                                   output the version number
    -t, --theme [theme]                             Theme of the chart, could be default, forest, dark or neutral. Optional. Default: default (default: default)
    -w, --width [width]                             Width of the page. Optional. Default: 800 (default: 800)
    -H, --height [height]                           Height of the page. Optional. Default: 600 (default: 600)
    -i, --input <input>                             Input mermaid file. Required.
    -o, --output [output]                           Output file. It should be either svg, png or pdf. Optional. Default: input + ".svg"
    -b, --backgroundColor [backgroundColor]         Background color. Example: transparent, red, '#F0F0F0'. Optional. Default: white
    -c, --configFile [configFile]                   JSON configuration file for mermaid. Optional
    -C, --cssFile [cssFile]                         CSS file for the page. Optional
    -s, --scale [scale]                             Puppeteer scale factor, default 1. Optional
    -p --puppeteerConfigFile [puppeteerConfigFile]  JSON configuration file for puppeteer. Optional
    -h, --help                                      output usage information
```


## Linux sandbox issue

```
node:8281) UnhandledPromiseRejectionWarning: Error: Failed to launch chrome!
[0416/092218.828861:ERROR:zygote_host_impl_linux.cc(88)] Running as root without --no-sandbox is not supported. See https://crbug.com/638180.
```

```
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

### Setup

    yarn install
    source copy_modules.sh


### Test

Use the fixtures in `test/` to do manual testing after you change something.
