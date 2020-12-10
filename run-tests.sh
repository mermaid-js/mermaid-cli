#!/bin/bash
INPUT_DATA=$1
IMAGETAG=$2

# Test if the CLI actually works (PNG)
for i in $(ls $INPUT_DATA/*.mmd); do docker run -v $(pwd):/data $IMAGETAG -i /data/$i -o /data/$i.png -w 800; done
for i in $(ls $INPUT_DATA/*.mmd); do cat $i | docker run -i -v $(pwd):/data $IMAGETAG -o /data/$i-stdin.png -w 800; done

# Test if the CLI actually works (PDF)
for i in $(ls $INPUT_DATA/*.mmd); do docker run -v $(pwd):/data $IMAGETAG -i /data/$i -o /data/$i.pdf; done
for i in $(ls $INPUT_DATA/*.mmd); do cat $i | docker run -i -v $(pwd):/data $IMAGETAG -o /data/$i-stdin.pdf; done
