FROM --platform=$BUILDPLATFORM node:22.23.4-alpine3.24 AS build

ENV CHROME_BIN="/usr/bin/chromium-browser" \
    PUPPETEER_SKIP_DOWNLOAD="true"

WORKDIR /app

COPY . /app/

RUN npm install \
    && npm pack \
    && npm cache clean --force

FROM node:22.23.4-alpine3.24 AS mermaid-cli-current

ENV CHROME_BIN="/usr/bin/chromium-browser" \
    PUPPETEER_SKIP_DOWNLOAD="true"

WORKDIR /app

COPY --from=build /app/*-mermaid-cli-*.tgz /install/

ADD install-dependencies.sh install-dependencies.sh
RUN chmod 755 install-dependencies.sh && /bin/sh install-dependencies.sh

RUN adduser -D mermaidcli
USER mermaidcli
WORKDIR /home/mermaidcli
RUN npm install $(ls -d /install/*.tgz) \
    && npm cache clean --force

ENV PATH="$PATH:/home/mermaidcli/node_modules/.bin/"

ADD puppeteer-config.json  /puppeteer-config.json

WORKDIR /data
ENTRYPOINT ["/home/mermaidcli/node_modules/.bin/mmdc", "-p", "/puppeteer-config.json"]
CMD [ "--help" ]
