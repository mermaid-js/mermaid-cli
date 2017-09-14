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
mmdc -i input.mmd -o output.svg -w 1024 -H 768
```

```
mmdc -i input.mmd -t forest
```


## Options

Please run the following command to see the latest options:

```
mmdc -h
```

The following is for your quick reference (may not be the latest version):

```
  Options:
    -V, --version          output the version number
    -t, --theme [name]     Theme of the chart. Optional. Default: default
    -w, --width [width]    Width of the page. Optional. Default: 800
    -H, --height [height]  Height of the page. Optional. Default: 600
    -i, --input <input>    * Input mermaid file. Required.
    -o, --output [output]  Output image file. Optional. Default: input + ".svg"
    -h, --help             output usage information
```
