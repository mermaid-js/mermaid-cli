#!/bin/bash
cp ./node_modules/@mermaid-js/mermaid/dist/mermaid.min.js .

mkdir -p fontawesome/css/
cp ./node_modules/@fortawesome/fontawesome-free-webfonts/css/* fontawesome/css/

mkdir -p fontawesome/webfonts/
cp ./node_modules/@fortawesome/fontawesome-free-webfonts/webfonts/* fontawesome/webfonts/
