import { $ } from "bun"

const mobile = import.meta.dir.replace(/\/scripts$/, "")
const app = `${mobile}/../app`

await $`bun run build`.cwd(app)
await $`rm -rf ${mobile}/www`
await $`mkdir -p ${mobile}/www`
await $`cp -R ${app}/dist/. ${mobile}/www/`
