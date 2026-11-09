# 上线收尾：买 .jp 域名 + Cloudflare + Caddy（HTTPS）

本文是 `05-deploy-vps.md` 第 10 节第 5 条的细化。目标：把
`http://153.115.43.228:3100` 换成 `https://你的域名.jp`，并把 3100 收回到本机只听
loopback。

**关键事实（已核实源码，不用重构建镜像）：**
- `SITE_URL` 是运行时 env 变量，`payload.config.ts:148` 读它当 `serverURL`。改服务器 `.env` 即可，无需重新构建。
- 前台 canonical/OG 走请求 host（`src/lib/site-url.ts:37`），所以只要反代正确转发 `Host` 头，前台 URL 自动跟随域名。

---

## 第 1 步：买 .jp 域名（在 xserver 买）

Cloudflare Registrar **不支持 `.jp`**（JPRS 管理，要日本联系地址）。所以：

1. 在 xserver 域名页面搜你想要的 `.jp` 名字，下单购买。
2. `.jp` 注册需要 JP 联系信息（组织名/地址）。xserver 会让你填，照实填，或让它当本地代理（proxy）。
3. 记下你买到的确切域名，下面统称 `你的域名.jp`，全文替换。

---

## 第 2 步：把 DNS 托管到 Cloudflare

1. 在 Cloudflare 注册/登录，Add a Site，输入 `你的域名.jp`。
2. 选 Free 计划，Cloudflare 会给出**两条 NS 记录**（如 `xxx.ns.cloudflare.com` / `yyy.ns.cloudflare.com`）。
3. 回到 xserver 域名控制台，把域名的 **Name Server 改成 Cloudflare 给的两条**。保存。
4. 等 5–30 分钟，Cloudflare 显示 "Active"（NS 全球生效）。

> 域名仍在 xserver 手里，只是 DNS 解析交给 Cloudflare。续费、改持有信息仍在 xserver。

---

## 第 3 步：加 DNS 记录 + 决定代理模式（二选一）

在 Cloudflare → DNS → Records 加一条 A 记录：

- **Type**: `A`
- **Name**: `@`（主域名）和一条 `www`（都指向同一 IP）
- **IPv4 address**: `153.115.43.228`
- **Proxy status**: 见下方两条路线

### 路线 A —— 灰云（DNS only），Caddy 自签证书【推荐先走这条】

- Proxy 设 **DNS only（灰云）**。浏览器直接连 VPS:443，Caddy 用 Let's Encrypt 自动签证书。
- Cloudflare SSL/TLS 模式随便（反正不代理），设 `Full` 即可。
- **优点**：最简单，和 `05` 既定方案完全一致，证书自动续。
- **缺点**：源站 IP（153.115.43.228）公开，admin 后台同机，理论可被直打。小站够用。

### 路线 B —— 橙云（Proxied），Cloudflare Origin 证书【上线后加固可选】

- Proxy 设 **Proxied（橙云）**。源站 IP 被 Cloudflare 挡住，免费 DDoS/CC 缓冲 + 边缘缓存。
- Cloudflare → SSL/TLS → 设 **Full (strict)**。
- Cloudflare → SSL/TLS → Origin Server → Create Certificate，下载 `origin.crt` + `origin.key`，传到 VPS（见第 5 步路线 B）。
- Caddy 改用这张证书终止 TLS（配置见下）。
- **多一步**：证书要手动从 Cloudflare 后台下。

> 建议先 A 跑通上线，之后再切 B（Caddy 配置几乎不动，只是换证书来源）。

---

## 第 4 步：VPS 上用 Compose 加 Caddy 服务

把 Caddy 跑成容器，和 `app` 在同一 compose 网络里，用服务名反代（不用 `127.0.0.1`，那是容器自己）。

**新增文件 `Caddyfile`（仓库根目录）：**

```caddy
{
    email 你的邮箱@example.com   # Let's Encrypt 注册邮箱，必填
}

你的域名.jp, www.你的域名.jp {
    reverse_proxy app:3100       # 路线 A：app 是 compose 服务名
    # encode gzip
}

# 路线 B 时把上面 site block 换成：
# 你的域名.jp, www.你的域名.jp {
#     tls /etc/caddy/origin.crt /etc/caddy/origin.key
#     reverse_proxy app:3100
# }
```

**`docker-compose.yml` 改动：**

1. `app` 的 ports 从 `'3100:3100'` 收回 loopback：

   ```yaml
   services:
     app:
       # ... 其余不变 ...
       ports:
         - '127.0.0.1:3100:3100'   # 改前是 '3100:3100'
   ```

2. 追加 caddy 服务：

   ```yaml
     caddy:
       image: caddy:2
       ports:
         - '80:80'
         - '443:443'
       volumes:
         - ./Caddyfile:/etc/caddy/Caddyfile:ro
         - caddy_data:/data
         - caddy_config:/config
         # 路线 B 才加下面这行，并先在 VPS 上放好 origin 证书：
         # - /srv/card-market/origin-certs:/etc/caddy:ro
       restart: unless-stopped
       depends_on:
         - app

   volumes:
     media:
     uptime-kuma:
     caddy_data:
     caddy_config:
   ```

> 80/443 已被安全组和 ufw 放行（`05` 第 6 节），ACME 的 HTTP-01 挑战能通，Caddy 首次启动自动拿到证书。

---

## 第 5 步：改 SITE_URL / B2 CORS / 后台密码

这些和域名强相关，少做一项前台或后台就会错。

1. **服务器 `.env`**：把
   `SITE_URL=http://153.115.43.228:3100`（或当前值）改成
   `SITE_URL=https://你的域名.jp`。
   这是运行时变量，改完 `docker compose up -d app` 重新加载即可，**不重构建镜像**。

2. **B2 桶 CORS**（Cloudflare 代理/直接都建议加 https）：
   把 [06 清单第 2 节](06-console-checklist.md) 那条规则的 `allowedOrigins` 数组
   **追加** https 域名、删掉 IP 和 localhost：
   `["https://card-market-nextjs.vercel.app", "https://你的域名.jp", "https://www.你的域名.jp"]`。
   其余字段尤其 `allowedOperations` 必须原样保留 `s3_put` / `s3_get` / `s3_head`，
   别改成 `PUT`；控制台若只给简版预设就继续用 B2 CLI 更新。
   否则后台大图直传被浏览器跨域拦掉（05 文档第 10 节第 2 条）。改完重传一张大图验证。

3. **后台默认管理员密码** `admin12345` 仍挂在公网 —— 上线当天或之前先改掉（第 10 节第 1 条，最紧急）。

4. （可选）凭据轮换：`.env` 曾进过构建产物、DB 密码出现在对话里，建议轮换 Neon/B2/Sentry/Xserver 密码（第 10 节第 3 条），改完同步 VPS `.env`。

---

## 第 6 步：发版 + 验证

在 VPS（根目录 `/srv/card-market`）：

```bash
# 1. 拉最新代码（含新增的 Caddyfile / compose 改动）
git pull

# 2. 重新起服务，Caddy 首次启动会向 Let's Encrypt 申请证书
docker compose up -d

# 3. 看 Caddy 是否拿到证书（首次约 10–30 秒）
docker compose logs --tail=50 caddy
# 看到 "Certificate obtained successfully" 即成功

# 4. 服务器内环回探测业务
curl -sS http://127.0.0.1:3100/api/health
```

从公网验证（你本机终端）：

```bash
curl -sS -I https://你的域名.jp/api/health   # 期望 200，且是 https
curl -sS -I https://你的域名.jp/             # 首页 200
# 打开 https://你的域名.jp/admin 确认后台能登、能传大图
```

验证清单：
- [ ] `https://你的域名.jp` 返回 200，浏览器地址栏小锁
- [ ] canonical / OG 指向 `https://你的域名.jp`（非 IP、非 3100）
- [ ] 后台 `/admin` 登录正常，上传一张大图成功（证明 B2 CORS 与 `If-None-Match` 条件写两层都通，见 [06 清单第 2 节](06-console-checklist.md)）
- [ ] `http://153.115.43.228:3100` 从公网应**不可达**（已收回 loopback）
- [ ] `docker compose ps` 显示 app、caddy 都 healthy/running

---

## 排错速查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| Caddy 起不来 / 证书申请超时 | 80 端口被挡或 ACME 连不通 | 确认安全组+ufw 放了 80/443；`docker compose logs caddy` 看挑战报错 |
| 访问 502 | caddy 连不到 app | 确认 `reverse_proxy app:3100` 用服务名；`docker compose ps` 看 app 是否 up |
| canonical 还是 IP | `SITE_URL` 没改或没 reload | 改 VPS `.env` 后 `docker compose up -d app` |
| 后台传图被拦 | 预检被 B2 拒：`allowedOrigins` 没加 https 域名，或 `allowedOperations` 写成了 `PUT` 而非 `s3_put`，或上传规则被排在了 `["*"]` 下载规则之后 | [06 清单第 2 节](06-console-checklist.md) 核对 2026-11-09 已生效的三条规则与预检命令；本文第 5 步第 2 条改 origin；改完重传验证 |
| 预检 200 但真正 PUT 回 501 | 不是 CORS、也不是 SDK 校验和参数（B2 容忍 `x-amz-checksum-crc32`）：Payload 为修 CVE-2026-105867 把 `If-None-Match: *` 硬编码进预签名 PUT，B2 不实现条件写 | [06 清单第 2 节「第二层」](06-console-checklist.md)：`src/lib/s3/b2-client-uploads.ts` 重签去掉该头，已挂进 `payload.config.ts`；改完需重新构建部署 |
| 证书 90 天到期 | Caddy 自动续，无需人工 | 偶尔 `docker compose restart caddy` 保活即可；Uptime Kuma 加一条证书到期监控 |
