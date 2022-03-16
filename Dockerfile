FROM node:alpine

ENV CHROME_BIN="/usr/bin/chromium-browser" \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD="true"

ARG VERSION

ADD install-dependencies.sh install-dependencies.sh
RUN chmod 755 install-dependencies.sh && /bin/sh install-dependencies.sh

RUN adduser -D mermaidcli
USER mermaidcli
WORKDIR /home/mermaidcli
RUN yarn add @mermaid-js/mermaid-cli@$VERSION

ADD puppeteer-config.json  /puppeteer-config.json
ENTRYPOINT ["./node_modules/.bin/mmdc", "-p", "/puppeteer-config.json"]
CMD [ "--help" ]
