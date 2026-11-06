# VPS 部署方案 v3（公网已通，收尾待办见第 10 节）

目标机器 `153.115.43.228`，Ubuntu 24.04 LTS，8 核 / 7.7G 内存 / 96G 磁盘。
`ssh root` 与 `ssh annilq` 均已实测连通。

**当前状态。** 公网已经打通。`http://153.115.43.228:3100` 的 `/api/health`、
首页、后台、`/api/cards`、三语路由、图片全部实测 200，canonical 也正确。
根因是 Xserver 的规则组建好之后没有绑定到 VPS 实例，绑定后立刻生效。

服务器内部早已全绿：镜像构建成功，`app` 容器 healthy，代码在 `5353a0d`，
ufw 与 SSH 加固已验证，Neon 数据已导入 Xserver 库，
生产 env 文件已生成且镜像内无 `.env`，`deploy.sh` 也实测跑通。

剩下的是上线收尾，见第 10 节。最要紧的一条是后台默认管理员密码还留在
公网可访问的纯 HTTP 站点上，需要尽快改掉。

## 1. 你的决定

| 项 | 决定 | 影响 |
| --- | --- | --- |
| 域名 | 暂时没有，用 `http://153.115.43.228:3100` 验收 | 纯 HTTP，登录和后台口令明文过网。只能临时验收，不要录入真实内容或真实管理员密码 |
| 数据库 | 内网 Xserver PostgreSQL，地址 `172.16.3.42` | 实测连通，PostgreSQL 16.14，Neon 的 23 张表与数据已导入，见第 7 节 |
| 发版方式 | 服务器 `git pull` + `deploy.sh` | `5353a0d` 已 push，VPS 已同步 |
| 授权 | 启用 ufw、加固 SSH | 已完成并验证 |
| 授权 | push 代码到 GitHub | 已完成 |
| 控制台 | 放行端口、加 B2 CORS | 你来做，步骤见 [06-console-checklist.md](06-console-checklist.md) |

## 2. 已核实的现状

### 项目

| 项 | 实测值 | 依据 |
| --- | --- | --- |
| 技术栈 | Next.js 16.4.3 + Payload CMS 3.92.1 + React 19 | [package.json](../package.json) |
| 数据库适配器 | `@payloadcms/db-postgres`，只支持 PostgreSQL | [package.json](../package.json#L20) |
| 构建 | `payload generate:types && next build`，`output: 'standalone'` | [package.json](../package.json#L8)、[next.config.mjs](../next.config.mjs#L7) |
| 依赖 | lockfileVersion 3，720 包，`npm ls --depth=0` 无缺失或冲突 | 本地只读检查 |
| 迁移 | `prodMigrations` 已挂，生产启动自动跑，不需要手动 `payload migrate` | [payload.config.ts](../src/payload.config.ts#L111)、`@payloadcms/db-postgres/dist/connect.js:116-120` |
| 健康检查 | `GET /api/health`，真实查询 `cards` 表 | [route.ts](../src/app/api/health/route.ts) |
| 种子数据 | 容器里跑不了，见第 7 节 | [seed.ts](../scripts/seed.ts#L12)、[Dockerfile](../Dockerfile#L20) |
| 外部服务 | Neon Postgres、Backblaze B2 私有桶、Sentry，凭据都在根目录 `.env` | 本地只读检查 |
| 仓库 | 公开仓库 `annilq/card-market-nextjs`，`main` 分支，工作树干净 | 本地 `git status`、GitHub API |

### 服务器

| 项 | 实测值 |
| --- | --- |
| 系统 | Ubuntu 24.04 LTS，内核 6.8，Asia/Tokyo，KVM / OpenStack |
| 已装 | Docker 29.9.3、Compose v5.7.0、git 2.43、ufw（未启用） |
| 未装 | Node、npm、nginx、certbot、psql、pm2 |
| 数据库 | 服务器上没有任何数据库进程或配置，没有 `/etc/mysql`、`/etc/postgresql` |
| 监听端口 | 只有 22 与本机 DNS |
| 防火墙 | ufw inactive，iptables 无自定义规则 |
| 出网 | Docker Hub 可拉取、GitHub 200、Let's Encrypt 200 |
| SSH | `PermitRootLogin yes`、`PasswordAuthentication yes` |
| 磁盘 | 96G 用了 4.4G |

`annilq` 在 sudo 组但 `sudo -n true` 需要密码，不在 docker 组，`/srv` 不可写。
它现在跑不了 `docker compose`。部署统一走 `ssh root`，不给它加 docker 组，
也不配免密 sudo。加入 docker 组等价于给了 root 能力，为跑一个单机服务放宽权限不划算。

### 网络

本机连 `153.115.43.228` 的 80、443、3100 三个端口，每次都在 4 秒连接超时。
服务器内部 ufw 是关的，也没有服务在听，所以更可能来自云平台的安全组。
这一层我读不到，需要你在云控制台确认。

服务器到 Neon 的 TCP 5432 连接耗时，五次样本为 256、176、173、174、173 毫秒。
本机到同一个 Neon 是 250 到 1256 毫秒。同机 Postgres 会低一个数量级，
这是后续要不要迁库的依据。

## 3. 部署前必须修掉的问题

以下六项已在阶段 0 修完，保留清单作为部署时的逐项验收依据。
独立审查复核了全部条目，每项都有文件和行号。

| # | 问题 | 证据 | 后果 | 最小修法 |
| --- | --- | --- | --- | --- |
| 1 | `PORT` 没设 | [server.js](../.next/standalone/server.js#L14) 默认 3000；[Dockerfile](../Dockerfile#L27) 只写 `EXPOSE 3100`；[compose](../docker-compose.yml#L5) 映射 `3100:3100` | 容器跑在 3000，外部拿不到服务 | compose 加 `PORT: '3100'` |
| 2 | 密钥进最终镜像 | `.env` 与 `.next/standalone/.env` 的 sha256 相同；[build/index.js](../node_modules/next/dist/build/index.js#L318) 会把 `.env` 复制进 standalone；[Dockerfile](../Dockerfile#L20) 再拷进 runner | 生产镜像里 `/app/.env` 就是明文凭据，任何能读 docker 的人都拿得到 | 加 `.dockerignore`，并轮换凭据 |
| 3 | 站点地址在构建时冻错 | [environment-variables.md](../node_modules/next/dist/docs/01-app/02-guides/environment-variables.md#L166) 写明 `NEXT_PUBLIC_` 构建后不再响应变化；[payload.config.ts](../src/payload.config.ts#L148) 与 [site-url.ts](../src/lib/site-url.ts#L18) 都读它 | 后台 `serverURL` 和 canonical 兜底指向 Vercel 域名，后台可能空白 | 构建时传 build arg，运行时设 `SITE_URL` |
| 4 | Compose 插值注入真实凭据 | 本地 `docker compose config` 实测：`PAYLOAD_SECRET`、`NEXT_PUBLIC_SITE_URL` 指 Vercel、`S3_BUCKET`/`S3_KEY`/`S3_SECRET` 都从 `.env` 取到值，`DATABASE_URI` 指向本地 postgres | 服务器放 `.env` 会把 dev 密钥和 B2 密钥写进容器环境，`docker inspect` 可读 | 服务器不放 `.env`，改用独立 env 文件 |
| 5 | 公开的默认口令 | [compose](../docker-compose.yml#L8) 的 `change-me-in-production` 与 [compose](../docker-compose.yml#L27) 的 `postgres/postgres` | JWT 签名可伪造，数据库超管可直接登录 | 改成 `${VAR:?}` 无默认值，随机生成 |
| 6 | 纯 HTTP 对外 | [compose](../docker-compose.yml#L5) 把 3100 发布在 `0.0.0.0`，无 TLS | 后台口令和 Cookie 明文过网 | 绑到 `127.0.0.1:3100`，HTTP 仅临时验收 |

第 2 条比我原先写的更严重。我先前判断"最终 runner 层不拷这些文件"是错的。
Next 16.4.3 会把 `.env` 复制进 standalone 目录，实测两个文件字节完全一致，
所以最终运行镜像本身就带明文凭据。镜像不推到 registry 时泄露范围限于这台 VPS，
但 root、docker socket、`docker cp`、`docker run --entrypoint cat` 都能读出来。
部署前要轮换 Neon、B2、Sentry 的凭据，并同步更新 Vercel 的环境变量。

### 其余要补的项

| 项 | 证据 | 修法 |
| --- | --- | --- |
| 无 app healthcheck、无 `restart`、无资源限制、无日志轮转、无备份 | [compose](../docker-compose.yml#L1) 全篇只有 `database` 有 healthcheck | 加 `restart: unless-stopped`、`/api/health` 探针、`deploy.resources`、`logging` 限额 |
| Dozzle 无认证，docker.sock 虽 `:ro` 仍是完整 Docker API | [compose](../docker-compose.yml#L41) | 保持只绑 `127.0.0.1`，公网暴露前加认证与 TLS |
| 监控容器用 `latest` 标签 | [compose](../docker-compose.yml#L39) | 固定版本 |
| `Dockerfile:24` 把 `.ts` 迁移文件拷进没有 TS loader 的运行镜像 | [Dockerfile](../Dockerfile#L24) | 确认无用后删掉 |
| `Dockerfile:23` 只拷 `sharp`，没拷 `@img/sharp-linux-*` | [Dockerfile](../Dockerfile#L23) | 交给 standalone 的 tracing，去掉 deps 阶段 |
| 构建上下文混进 macOS 的 `.next/` 和 `node_modules/` | 无 `.dockerignore`，[Dockerfile](../Dockerfile#L12) 的 `COPY . .` | 同一份 `.dockerignore` 一并解决 |

## 4. 依赖怎么装、怎么测

服务器上不需要装 Node。[Dockerfile](../Dockerfile#L2) 用 `node:24-slim`，
`npm ci` 和 `next build` 都在容器里完成，宿主机只要 Docker、Compose、git，三样已经装好。
`npm ci` 需要访问 registry，所以完全离线的构建不可能。

验收按顺序，每步过了才走下一步。

1. `docker compose config` 能解析，变量齐全。
2. `docker compose build` 完整跑完，`npm ci` 与 `next build` 都在日志里成功。
3. `docker compose up -d` 后 `docker compose ps` 显示 app 为 running。
4. 服务器内部 `curl -sS http://127.0.0.1:3100/api/health` 返回 200 且 `status` 是 `ok`。
   这个端点会真的查 `cards` 表，200 就证明 Next、Payload、数据库整条链路通了。
5. 从公网 `http://153.115.43.228:3100/api/health` 返回 200，首页、`/admin`、`/api/cards` 逐个 200。

第 4 步是关键。只看 `docker compose ps` 或"构建没报错"都不算证明服务可用。

## 5. 发版方式

你已选服务器 `git pull` 加 `deploy.sh`。CI/CD 留到需要多人协作或一天多次发布时再加。
`deploy.sh` 每次从 `git pull` 开始。构建失败时旧容器不动。
健康检查没过会停在出问题的新版本，打印日志命令和回滚命令，不偷偷切换。
push 到 GitHub 已授权，阶段 0 的修正会在你确认 diff 后推上去。

阶段 0 已完成的文件：`.dockerignore`、`Dockerfile`、`docker-compose.yml`、`deploy.sh`。
`docker compose config --quiet` 与 `bash -n deploy.sh` 都通过。

## 6. 公网与安全

**云安全组。** 只有你能操作。放行入站 TCP 80 和 443 供以后上 HTTPS，
本次 HTTP 验收还需要放行 3100。22 建议限制到你自己的出口 IP。
不要放行 5432、8080、3001。实测公网连这些端口超时，这一步不做后面全白做。

**ufw。** 已授权。先放行 22、3100、80、443，再 `ufw enable`。
顺序不能反，先启用再放行会把自己锁在 SSH 外面。22 加 `limit` 限速。
启用后另开一个 SSH 连接验证，再关掉旧会话。

**HTTP 验收的边界。** 没有域名就没有 HTTPS 证书，Caddy 这次不上。
`app` 发布 `0.0.0.0:3100:3100`，由云安全组和 ufw 控制谁能访问。
纯 HTTP 期间只做"服务能不能跑通"的验证。不要在这个地址上录真实卡牌数据、
不要设真实管理员密码、不要把它当正式站点发出去。拿到域名后立刻补 Caddy 和证书。

**SSH 加固。** 已授权。改成 `PasswordAuthentication no` 和
`PermitRootLogin prohibit-password`，保留 root 密钥登录作为应急通道。
不改 `PermitRootLogin no`，因为 `annilq` 目前没有可用的提权方式，禁掉 root 登录会失去应急入口。
执行时保留一个已连接会话不关，改完另开连接验证通过才收工。

**密钥。** 服务器上的 `.env` 由我在部署时生成，只写本项目需要的键，
不把本地那份含 Vercel 地址和冗余 `PG*` 变量的文件传上去，权限 `600`。
`.dockerignore` 已排除 `.env*`，镜像里没有文件副本。
`NEXT_PUBLIC_*` 走 compose 的 `build.args`，其余走 `env_file`。
`PAYLOAD_SECRET` 随机生成，不沿用 dev 值。
部署完成后轮换 Neon、B2、Sentry 凭据，并同步更新 Vercel 环境变量。

**应用层。**

- `serverURL` 在 VPS 上没有 `VERCEL=1`，会回退到 `SITE_URL` 或构建时内联的
  `NEXT_PUBLIC_SITE_URL`（见 [payload.config.ts](../src/payload.config.ts#L145)）。
  运行时设 `SITE_URL=http://153.115.43.228:3100` 就能覆盖，不必等到有域名。
  [site-url.ts](../src/lib/site-url.ts#L37) 的 `getOrigin()` 用请求 host，
  canonical 与 OG 在请求上下文里不受影响。
- B2 桶 CORS 需要允许 `http://153.115.43.228:3100`，否则后台大图直传被浏览器拦掉。
  图片显示不受影响，已经验证正常。
  当前规则需要你在 B2 控制台确认，改规则也需要你的控制台权限。
- 后台首个管理员账号走 Payload 的 `/admin` 首次用户流程创建，不要用默认值。
- Dozzle 和 Uptime Kuma 在 [compose](../docker-compose.yml#L43) 已绑 `127.0.0.1`，
  保持不动。这次不暴露到公网。

## 7. 数据库：已定 Xserver PostgreSQL，只差连接信息

你确认了 Xserver 附带的是 PostgreSQL，项目用的是
`@payloadcms/db-postgres`，类型匹配。你给的地址是 `172.16.3.42`，与 VPS 同内网。
需要的字段和传递方式写在 [06-console-checklist.md](06-console-checklist.md) 第 3 节。

**已经在 VPS 上实测过这条链路。** TCP 5432 在 5.6 毫秒内连通，
VPS 内网 IP 是 `172.16.0.3`，走 `enp3s0`。用 `postgres/postgres` 试探时被
`pg_hba.conf` 拒绝，`sslmode=require` 报 `server does not support SSL`。
换成面板给的 `koduckya` 账号后直连成功。所以之前不是来源 IP 没授权，
是账号不对，白名单那一步不用做。这个库是 PostgreSQL 16.14，没开 SSL，
连接串不要带 `sslmode=require`。`pg_trgm` 可用，账号有 CREATE 权限。

数据已从 Neon 导入。源库是 PostgreSQL 18.6，目标是 16.14，跨大版本，
所以用纯 SQL 导出，只取 `public` schema，去掉 PG18 的 `\restrict` 元命令、
`SET transaction_timeout` 和 `CREATE SCHEMA public`，补上 `CREATE EXTENSION pg_trgm`，
再用单事务导入。失败会整笔回滚，方便重来。第一次导入因目标库已有 public schema
被回滚，过滤 schema 语句后第二次成功。最终 23 张表、6 张卡、2 个用户、
3 个 banner，`pg_trgm` 已建好。Neon 原库没有改动。

**空库这件事要提前决定。** 生产启动时迁移会自动建表（已核实 `prodMigrations` 生效），
但种子数据跑不了。[seed.ts](../scripts/seed.ts#L12) 硬编码了
`/Users/annilq/Documents/develop/card-market` 这个 macOS 绝对路径，
[Dockerfile](../Dockerfile#L20) 也没把 `scripts/`、`tsx` 或种子图片拷进镜像。
所以空库首次启动后，管理员要靠 `/admin` 首次流程自己建，
维度集合和 SiteSettings 是空的，前台页面可能没有内容。
独立审查把"空库是否会让前台直接报错"标为未验证，我不猜，部署时实测。

两条数据方案。

| 方案 | 做法 | 代价 | 结论 |
| --- | --- | --- | --- |
| 从现有 Neon 导出导入 | `pg_dump` 出结构和数据，再灌进 Xserver 库 | 需要两边都能连，要处理扩展与权限 | 推荐，现有卡牌和图片引用都在 Neon 里 |
| 接受空库，修 seed 脚本 | 把硬编码路径改成环境变量，把种子图片带进镜像或挂载卷，让容器能跑 `tsx` | 要改脚本和镜像，且 seed 数据未必覆盖全部内容 | 备选，只在导出不可行时用 |

我的建议是先把连接信息给我，在 VPS 上测通，再从 Neon 导出导入。
两端都能连的话，这一步比修 seed 脚本快，也不会丢数据。

## 8. 监控与日常运维入门

项目已经把三层监控写进 [compose](../docker-compose.yml#L36) 和
[README](../README.md#L135)，不需要重新发明。

| 层 | 工具 | 看什么 | 什么时候看 |
| --- | --- | --- | --- |
| 错误 | Sentry | 服务端异常、Server Action 报错、前端崩溃 | 有告警就去看，每周扫一次趋势 |
| 日志 | Dozzle (`127.0.0.1:8080`) | app 容器 stdout，可搜索 | 出事时第一站 |
| 存活 | Uptime Kuma (`127.0.0.1:3001`) | `/api/health`、首页、证书到期 | 配好告警后等它推给你 |
| 主机资源 | 可选 Netdata | CPU、内存、磁盘 | 磁盘超过 80% 再关注 |

**几个词先说清。** 容器是把程序和依赖打包成的隔离进程，删了容器不会删数据，
数据放在卷里。反向代理是挡在程序前面的门卫，外部只和它说话，由它转发给内部程序。
安全组是云厂商那层的门禁，ufw 是服务器自己那层的门禁，两层都要开才通。
健康检查是一个专门的地址，探测程序会真去查一次数据库，返回 200 才算活着。

**发版流程。** 本地改代码并 commit，push 到 `main`。在服务器执行 `deploy.sh`。
脚本拉代码、构建新镜像、替换容器、跑健康检查。通过了就结束，
没通过就打印回滚命令，服务保持旧版本。不要在服务器上直接改代码，那样下次 pull 会冲突。

**出事先看这三样。** `docker compose ps` 看哪个容器不是 running。
`docker compose logs --tail=100 app` 看最近的错误。
`curl -sS http://127.0.0.1:3100/api/health` 看业务链路是否还通。
三样都正常但外面打不开，就是 ufw、安全组或 DNS 的问题，往下层查。

**备份。** 数据在数据库和 B2 桶两处，代码和迁移在 Git。
最容易被忽略的是"备份能不能恢复"，每季度把 dump 导到本地测试库导回去一次，
确认文件不是空的。

**回滚。** 记下当前部署的 commit hash。出问题时 `git checkout <hash>` 再跑一次 `deploy.sh`。
镜像按源码构建，回滚要重新构建，需要几分钟。

## 9. 执行清单

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| 0 | 修 `PORT`、加 `.dockerignore`、改 compose 的 env 与 healthcheck/restart/日志、加 build arg、写 `deploy.sh` | 已完成。`5353a0d` 已 push，VPS 已同步 |
| 1 | 用 `ssh root` 建 `/srv/card-market`，生成生产 env 文件并 `chmod 600`。配置 ufw 并另开连接验证。SSH 加固 | 已完成并验证 |
| 2 | 从 Neon 导出数据导入 Xserver 库 | 已完成，23 张表与业务数据校验通过 |
| 3 | `docker compose build`、`up -d`、跑第 4 节的第 4 步健康检查 | 已完成，容器 healthy，页面与图片全绿 |
| 4 | 你完成安全组放行。从公网验证 `/api/health`、首页、`/admin`、`/api/cards` | 已完成。根因是规则组没绑定 VPS，绑定后公网全绿 |
| 5 | 改后台默认管理员密码。确认 B2 CORS 允许 `http://153.115.43.228:3100`，验证后台上传大图 | 待办，见第 10 节 |
| 6 | 配置 Uptime Kuma 监控项与告警，确认 Sentry 上报，交付运维手册与回滚命令 | 待办，见第 10 节 |

每阶段结束给你一条简短结果和下一步，任一步没过就停在那里，不往下做。

## 10. 上线收尾待办

按优先级排。前两项是安全，建议今天就做。

**需要你在浏览器或控制台做的。**

1. **改后台默认管理员密码。** 导入的数据里带着 `admin@example.com` / `admin12345`，
   而站点现在全网可访问。登录 `http://153.115.43.228:3100/admin` 后立刻改掉。
2. **在 B2 桶新建第一条 CORS 规则，允许 `http://153.115.43.228:3100`。**
   B2 原生只读接口已确认桶上 `corsRules` 是空的，一条规则都没有，所以不是追加。
   建议 `allowedOrigins` 同时写上 Vercel 域名和新地址，两边部署的后台上传都能用。
   验证方法是在后台上传一张大图，能传成功就是生效了。
3. **轮换凭据。** 数据库密码出现在对话里了，去 Xserver 面板改，改完告诉我，
   我同步生产 env 文件。Neon、B2、Sentry 的凭据也建议轮换，因为本地 `.env`
   曾经进过构建产物，轮换后记得同步 Vercel 的环境变量。
4. **配置 Uptime Kuma。** 用 [06 清单第 5 节](06-console-checklist.md) 的 SSH 隧道
   打开 `http://127.0.0.1:3001`，建管理员账号，加 `/api/health` 和首页两个监控项，
   再接一个告警渠道。
5. **买域名并上 HTTPS。** 现在 80、443 已放行但没有服务监听，是快速拒绝。
   上了域名后我加 Caddy 反代和自动证书，把纯 HTTP 的 3100 收回到本机。
   这一步做完才算正式上线。

**我可以直接做，等你点头。**

6. **定时数据库备份。** 在 VPS 上加一个 cron，每天 `pg_dump` 到加密目录，
   保留 7 天，并每季度做一次恢复演练。
7. **验证 Sentry 上报。** 触发一条测试异常，你在 Sentry 控制台确认收到。
8. **公网性能观测。** 首页公网实测 2.59 秒，服务器内部 0.06 秒。
   差在跨境网络，不是应用。正式上线后值得持续看一周。

**已经做完不用再管的。** 代码以 `5353a0d` 推送并在 VPS 同步，ufw 与 SSH 加固已验证，
Xserver 数据库连通，Neon 数据导入完成，生产 env 文件已生成，镜像构建成功，
服务 healthy，`deploy.sh` 实测 `DEPLOY_RC=0`，公网访问全绿。

## 11. 本次不做什么

不改业务代码，不停用原 Vercel 部署，不引入 CI 平台，不迁 B2 桶内容，
不删服务器上的任何现有文件，不在纯 HTTP 地址上录入真实内容。
这些都不影响这次验收，留到后面按需要决定。
