#!/bin/sh
INPUT_DATA=$1
IMAGETAG=$2

set -e

# If no image tag is provided, build the Docker image
if [ -z "$IMAGETAG" ]; then
  echo "No image tag provided, building Docker image..."
  # Get the current package version from package.json
  VERSION=$(node -p "require('./package.json').version")
  IMAGETAG="mermaid-cli:test"
  docker build --build-arg VERSION=$VERSION -t $IMAGETAG .
fi

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

# Test if passing custom Iconify icons work
outputFileName="/data/$INPUT_DATA/architecture-diagram-logos-with-icons.png"
docker run --rm -v $(pwd):/data $IMAGETAG \
  -i /data/$INPUT_DATA/architecture-diagram-logos.mmd \
  --iconPacks '@iconify-json/logos' \
  -o "$outputFileName"

# Test if a diagram from STDIN can be understood
cat $INPUT_DATA/flowchart1.mmd | docker run --rm -i -v $(pwd):/data $IMAGETAG -o /data/$INPUT_DATA/flowchart1-stdin.png -w 800

# Test if mmdc crashes on Markdown files containing no mermaid charts
OUTPUT=$(docker run --rm -v $(pwd):/data $IMAGETAG -i /data/test-positive/no-charts.md)
EXPECTED_OUTPUT="No mermaid charts found in Markdown input"
[ "$OUTPUT" = "$EXPECTED_OUTPUT" ] || echo "Expected output to be '$EXPECTED_OUTPUT', got '$OUTPUT'"

# Test if mmdc does not replace <br> with <br/>
docker run --rm -v $(pwd):/data $IMAGETAG \
  -i /data/test-positive/graph-with-br.mmd \
  --width 800 \
  --configFile "/data/$config_noUseMaxWidth"
if grep -q "<br>" "./test-positive/graph-with-br.mmd.svg"; then
  echo "<br> has not been replaced with <br/>";
  exit 1;
fi

# Test if --artefacts works correctly
# Create the artefact directory
mkdir -p $INPUT_DATA/static

# Run mmdc with --artefacts using existing test file
docker run --rm -v $(pwd):/data $IMAGETAG \
  -i /data/test-positive/mermaid.md \
  --artefacts /data/$INPUT_DATA/static

# Verify that the images were created in the specified path
if [ ! -f "$INPUT_DATA/static/mermaid-1.png" ]; then
  echo "Images were not created in the specified artefact path";
  exit 1;
fi

# Verify that the generated markdown file contains the correct image links
if ! grep -q "![mermaid-1](static/mermaid-1.png)" "$INPUT_DATA/static/mermaid.md"; then
  echo "Generated markdown file does not contain the correct image links";
  exit 1;
fi

# Clean up
rm -rf $INPUT_DATA/static
