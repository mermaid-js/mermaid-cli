# https://chromium.googlesource.com/chromium/src/+/HEAD/docs/linux/suid_sandbox_development.md

# cd to the downloaded instance
cd ./node_modules/puppeteer/.local-chromium/linux-*/chrome-linux/
chown root:root chrome_sandbox
chmod 4755 chrome_sandbox
# copy sandbox executable to a shared location
cp -p chrome_sandbox /usr/local/sbin/chrome-devel-sandbox
