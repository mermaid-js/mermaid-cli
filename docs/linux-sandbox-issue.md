```
(node:8281) UnhandledPromiseRejectionWarning: Error: Failed to launch chrome!
[0416/092218.828861:ERROR:zygote_host_impl_linux.cc(88)] Running as root without --no-sandbox is not supported. See https://crbug.com/638180.

(node:8191) UnhandledPromiseRejectionWarning: Error: Failed to launch chrome!
[0416/091938.210735:FATAL:zygote_host_impl_linux.cc(124)] No usable sandbox! Update your kernel or see https://chromium.googlesource.com/chromium/src/+/master/docs/linux_suid_sandbox_development.md for more information on developing with the SUID sandbox. If you want to live dangerously and need an immediate workaround, you can try using --no-sandbox.
```

First and foremost, you should not run as root and you should upgrade your Linux kernel to latest version.

But if you don't want to follow the advice above and just want to disable sandbox, here you go:

Create a `puppeteer-config.json` file:

```json
{
  "args": ["--no-sandbox"]
}
```

And when you invoke `mmdc`:

```sh
mmdc -p puppeteer-config.json ...
```
