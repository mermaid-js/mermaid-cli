FROM node:current-slim

ARG VERSION

ADD install-dependencies.sh /install-dependencies.sh

RUN chmod 755 /install-dependencies.sh && /install-dependencies.sh

RUN useradd -ms /bin/bash mermaidcli
USER mermaidcli
WORKDIR /home/mermaidcli
RUN yarn add @mermaid-js/mermaid-cli@$VERSION

ADD puppeteer-config.json  /puppeteer-config.json
ENTRYPOINT ["./node_modules/.bin/mmdc", "-p", "/puppeteer-config.json"]
CMD [ "--help" ]
