#!/bin/bash
INPUT_DATA=$1
IMAGETAG=$2

# Test if the CLI actually works (PNG, PDF and SVG)
# If there is a corresponding .css for a test, it will be used as an additional parameter: -C <css-file>

for test in $(ls $INPUT_DATA/*.mmd); do
  STYLE_PARAMS=""

  STYLE=$INPUT_DATA/`basename $test .mmd`.css
  if [ -f $STYLE ] ; then
    STYLE_PARAMS="-C /data/$STYLE"
  fi

  for fmt in png pdf svg; do
    EXTRA_PARAMS=""

    if [ "$fmt" = "png" ] ; then
      EXTRA_PARAMS="-w 800"
    fi
    docker run -v $(pwd):/data $IMAGETAG -i /data/$test $STYLE_PARAMS -o /data/$test.$fmt $EXTRA_PARAMS
    cat $test |  docker run -i -v $(pwd):/data $IMAGETAG $STYLE_PARAMS -o /data/$test-stdin.$fmt $EXTRA_PARAMS

  done
done

