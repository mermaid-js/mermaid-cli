# mermaid.cli

Command-line interface for [mermaid](https://mermaidjs.github.io/).

This CLI tool takes a mermaid definition file as input and generates svg/png/pdf file as output.


## Install locally

Some people are [having issue](https://github.com/mermaidjs/mermaid.cli/issues/15) installing this tool globally. Installing it locally is an alternative solution:

```
yarn add mermaid.cli
./node_modules/.bin/mmdc -h
```

Or use NPM:

```
npm install mermaid.cli
./node_modules/.bin/mmdc -h
```


## Install globally

❗️ We do **NOT** recommend installing it globally because both YARN and NPM could fail to install a command line tool globally properly due to weird permission issues.

```
yarn global add mermaid.cli
```

 Or

```
npm install -g mermaid.cli
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
    -p --puppeteerConfigFile [puppeteerConfigFile]  JSON configuration file for puppeteer. Optional
    -h, --help                                      output usage information
```


## For contributors

### Setup

    yarn install
    cp ./node_modules/mermaid/dist/mermaid.min.js .
    source downloader.sh


### Test

Use the fixtures in `test/` to do manual testing after you change something.
