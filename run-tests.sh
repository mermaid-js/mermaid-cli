#!/bin/sh
INPUT_DATA=$1
IMAGETAG=$2

set -e

# we must set `useMaxWidth: false` in config` to convert-svg-to-png for Percy CI
config_noUseMaxWidth="$INPUT_DATA/config-noUseMaxWidth.json"

# Test if the CLI actually works (PNG)
for i in $(ls $INPUT_DATA/*.mmd); do docker run --rm -v $(pwd):/data $IMAGETAG -i /data/$i -o /data/$i.png -w 800; done

# Test if the CLI actually works (PNG) for md files
for i in $(ls $INPUT_DATA/*.md); do docker run --rm -v $(pwd):/data $IMAGETAG -i /data/$i -o /data/$i.png  -w 800; done

# Test if the CLI actually works (PDF)
for i in $(ls $INPUT_DATA/*.mmd); do docker run --rm -v $(pwd):/data $IMAGETAG -i /data/$i -o /data/$i.pdf; done

# Test if passing background colors works
for format in "svg" "png"; do
  # must have different names, since we convert .svg to .png for percy upload
  outputFileName="/data/$INPUT_DATA/flowchart1-red-background-${format}.${format}"

  docker run --rm -v $(pwd):/data $IMAGETAG \
    -i /data/$INPUT_DATA/flowchart1.mmd \
    --configFile "/data/$config_noUseMaxWidth" \
    --backgroundColor "red" \
    -o "$outputFileName"
done

# Test if passing CSS styles works
for format in "svg" "png"; do
  # must have different names, since we convert .svg to .png for percy upload
  outputFileName="/data/$INPUT_DATA/flowchart1-with-css-${format}.${format}"

  docker run --rm -v $(pwd):/data $IMAGETAG \
    -i /data/$INPUT_DATA/flowchart1.mmd \
    --configFile "/data/$config_noUseMaxWidth" \
    --cssFile /data/$INPUT_DATA/flowchart1.css \
    -o "$outputFileName"
done

# Test if a diagram from STDIN can be understood
cat $INPUT_DATA/flowchart1.mmd | docker run --rm -i -v $(pwd):/data $IMAGETAG -o /data/$INPUT_DATA/flowchart1-stdin.png -w 800

# Test if mmdc crashes on Markdown files containing no mermaid charts
OUTPUT=$(docker run --rm -v $(pwd):/data $IMAGETAG -i /data/$INPUT_DATA/no-charts.md)
EXPECTED_OUTPUT="No mermaid charts found in Markdown input"
[ "$OUTPUT" = "$EXPECTED_OUTPUT" ] || echo "Expected output to be '$EXPECTED_OUTPUT', got '$OUTPUT'"

# Test if mmdc does not replace <br> with <br/>
outputFileName="graph-with-br.svg"
docker run --rm -v $(pwd):/data $IMAGETAG \
  -i "/data/$INPUT_DATA/graph-with-br.mmd" \
  --width 800 \
  --configFile "/data/$config_noUseMaxWidth" \
  -o "$outputFileName"
if grep -q "<br>" "$outputFileName"; then
  echo "<br> has not been replaced with <br/>";
  exit 1;
fi
