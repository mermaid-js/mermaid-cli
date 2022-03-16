#!/bin/bash

# Install chromium and required fonts
# available fonts https://wiki.alpinelinux.org/wiki/Fonts
apk add chromium font-noto-cjk font-noto-emoji \
    terminus-font ttf-dejavu ttf-freefont ttf-font-awesome \
    ttf-inconsolata ttf-linux-libertine \
    && fc-cache -f
