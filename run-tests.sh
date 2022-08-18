#!/bin/bash
INPUT_DATA=$1
IMAGETAG=$2

set -e

# Test if the CLI actually works (PNG)
for i in $(ls $INPUT_DATA/*.mmd); do docker run --rm -v $(pwd):/data $IMAGETAG -i /data/$i -o /data/$i.png -w 800; done

# Test if the CLI actually works (PNG) for md files
for i in $(ls $INPUT_DATA/*.md); do docker run --rm -v $(pwd):/data $IMAGETAG -i /data/$i -o /data/$i.png  -w 800; done

# Test if the CLI actually works (PDF)
for i in $(ls $INPUT_DATA/*.mmd); do docker run --rm -v $(pwd):/data $IMAGETAG -i /data/$i -o /data/$i.pdf; done

# Test if a diagram from STDIN can be understood
cat $INPUT_DATA/flowchart1.mmd | docker run --rm -i -v $(pwd):/data $IMAGETAG -o /data/$INPUT_DATA/flowchart1-stdin.png -w 800

# Test if mmdc crashes on Markdown files containing no mermaid charts
OUTPUT=$(docker run --rm -v $(pwd):/data $IMAGETAG -i /data/test-positive/no-charts.md)
EXPECTED_OUTPUT="No mermaid charts found in Markdown input"
[[ "$OUTPUT" == "$EXPECTED_OUTPUT" ]] || echo "Expected output to be '$EXPECTED_OUTPUT', got '$OUTPUT'"

# Test if mmdc does not replace <br> with <br/>
docker run --rm -v $(pwd):/data $IMAGETAG -i /data/test-positive/graph-with-br.mmd -w 800;
if grep -q "<br>" "./test-positive/graph-with-br.mmd.svg"; then
  echo "<br> has not been replaced with <br/>";
  exit 1;
fi
