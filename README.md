# mermaid.cli

Command-line interface for [mermaid](https://mermaidjs.github.io/).

This CLI tool takes a mermaid definition file as input and generates svg/png file as output.


## Installation

```
yarn global add mermaid.cli
```

 Or

```
npm install -g mermaid.cli
```

Please install via `npm` instead of `yarn` if you encounter [this issue](https://github.com/yarnpkg/yarn/issues/2224).


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

    -V, --version                            output the version number
    -t, --theme [name]                       Theme of the chart, could be default, forest, dark or neutral. Optional. Default: default
    -w, --width [width]                      Width of the page. Optional. Default: 800
    -H, --height [height]                    Height of the page. Optional. Default: 600
    -i, --input <input>                      Input mermaid file. Required.
    -o, --output [output]                    Output file. It should be either svg, png or pdf. Optional. Default: input + ".svg"
    -b, --backgroundColor [backgroundColor]  Background color. Example: transparent, red, '#F0F0F0'. Optional. Default: white
    -c, --configFile [config]                JSON configuration file for mermaid. Optional
    -C, --cssFile [cssFile]                  CSS alternate file for mermaid. Optional
    -h, --help                               output usage information
```


## For contributors

### Setup

    yarn install
    cp ./node_modules/mermaid/dist/mermaid.min.js .


### Test

Use the fixtures in `test/` to do manual testing after you change something.
