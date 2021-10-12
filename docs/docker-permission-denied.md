When running the Docker image with Docker or Podman you get the following error:
```
› podman run -it -v "$(pwd)":/data:z minlag/mermaid-cli -i /data/diagram.mmd
node:fs:582
  handleErrorFromBinding(ctx);
  ^

Error: EACCES: permission denied, open '/data/diagram.mmd.svg'
    at Object.openSync (node:fs:582:3)
    at Object.writeFileSync (node:fs:2143:35)
    at /home/mermaidcli/node_modules/@mermaid-js/mermaid-cli/index.bundle.js:169:10
    at Generator.next (<anonymous>)
    at step (/home/mermaidcli/node_modules/@mermaid-js/mermaid-cli/index.bundle.js:4:191)
    at /home/mermaidcli/node_modules/@mermaid-js/mermaid-cli/index.bundle.js:4:361
    at processTicksAndRejections (node:internal/process/task_queues:96:5) {
  errno: -13,
  syscall: 'open',
  code: 'EACCES',
  path: '/data/diagram.mmd.svg'
}
```
You can solve this issue by using docker `-u` option with your `UID`:
```
docker run -u $UID -it --rm -v "$(pwd)":data minlag/mermaid-cli -i /data/diagram.mmd
```

The issue is described [here](https://github.com/mermaid-js/mermaid-cli/issues/140)
