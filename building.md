# Simple steps to test this locally

1. Add a .npmrc file

```
registry=https://registry.npmjs.com/
@mermaid-js:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken="YOUR-TOKEN"
```

Generate the auth token from the github profile page => settings => developer settings => personal access tokens. Click on the button “Generate new token” and check the checkboxes concerning repo and github registry.

Instead of creating a .npmrc file on your own you can also use npm login --registry=https://npm.pkg.github.com which gives you an interactive prompt for entering your credentials.

1. Do yarn

```sh
yarn
```

2. Run the bash script copy_modules.sh

3. Run the script like below:

```sh
node src/cli.js -i test/state1.mmd
```
