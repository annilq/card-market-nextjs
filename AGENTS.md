<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- 以下为项目自定义约定，不在 next dev 自动生成块内，不会被覆盖 -->

## 每次改动后必须做本地验证

用户要求：**每次更改或添加功能后，都要先在本地实际验证，再交付**。静态检查通过不等于验证完成。

测试环境由 Vercel 在 `git push` 后自动部署，因此**不要主动 push / 部署，也不要操作测试环境**；本地验证通过即可交付。

### 固定检查

1. `npm run typecheck`。
2. 改了 Payload 配置或自定义组件路径时，跑 `npx payload generate:importmap`，并确认 `src/app/(payload)/admin/importMap.js` 的差异符合预期。
3. 用真实浏览器打开本地后台，把本次改动的关键交互实际点一遍，确认无 JS 报错。

### 本地浏览器验证要点

- 地址用 **`http://localhost:3100`**，不要用 `127.0.0.1`。后者会让 dev 的 HMR WebSocket 握手失败，React 不 hydrate：SSR 会输出完整 DOM（看起来像正常），但表单停在骨架屏、点击无效，会造成假阴性。
- 登录：`POST http://localhost:3100/api/users/login`（JSON `{"email": ..., "password": ...}`），从 `set-cookie` 取 `payload-token`，用 `page.setCookie` 注入浏览器上下文。
- 凭据由用户在会话中提供；**不要把明文密码写进仓库任何文件**。如需长期自动化，放在已被 `.gitignore` 忽略的 `.env` 里读取。
- 浏览器可用本机 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` + 仓库自带的 `puppeteer-core`，无头模式即可，不必安装额外依赖。
- 判断页面真正就绪要看 `document.querySelector('[data-form-ready]')?.getAttribute('data-form-ready') === 'true'`，不能只看目标 DOM 出现（SSR 会先输出骨架屏）。
- react-select 的选项是异步加载的：打开菜单后要等选项稳定再取快照，固定短等待容易只读到「当前选中项」。
- `npm run dev` 已在 3100 端口运行时不要另起服务；改了 config / importMap 后若 HMR 没生效，提示用户重启 dev 而不是自己动服务。
