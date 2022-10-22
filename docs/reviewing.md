# Reviewing a PR

## Running Percy Visual Inspection tests from a PR from a fork

In order to run Percy visual inspection tests, a PR from a fork may have to
be brought into the main repo.

This is because uploading to Percy requires a GitHub Secret token, which cannot
be accessed from forks for security reasons.

After you have reviewed the work, and made sure there is no security exploit
(e.g. no `echo "$TOKEN"`), then you can run the following to get percy working:

```bash
git switch -c "<NAME_OF_YOUR_BRANCH>"
git pull "https://github.com/<NAME_OF_YOUR_USERNAME>/mermaid-cli.git" "<NAME_OF_YOUR_BRANCH>"
# Make sure the commit hash matches the commit hash of the PR you reviewed
git log --max-count=1
git push git@github.com:mermaid-js/mermaid-cli.git "<NAME_OF_YOUR_BRANCH>"
```

After pushing, CI should re-run on that commit, and Percy should show up on the
PR after a few minutes, **as long as both branches have the same commit hash**.
