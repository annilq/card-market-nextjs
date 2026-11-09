# 上线收尾与排查清单

我看不到 Xserver 面板和 Backblaze B2 控制台，所以下面给的是关键词和验证方法，
不是某个具体按钮的位置。找不到菜单就截图发我，我按截图告诉你点哪里。

## 1. 在 Xserver 面板放行端口

要放行的入站 TCP 端口是 22、80、443、3100。

- 22 建议把来源限制成你自己的出口 IP，不要对全网开放。
- 80 和 443 供以后加域名上 HTTPS 用。
- 3100 是这次 `http://153.115.43.228:3100` 验收要用的。
- 不要放行 5432、8080、3001。数据库和两个监控面板都不该直接暴露。

在面板里按这些词找：`ファイアウォール`、`セキュリティグループ`、`ポート開放`、
`パケットフィルタ`、`Firewall`、`Security Group`、`Inbound Rules`。
常见路径是 VPS パネル 里的「サーバー」或「ネットワーク」分区。

改完告诉我一声，我从本机测端口。你也可以在自己电脑终端先测：

```bash
nc -z -w3 153.115.43.228 3100 && echo OK
```

服务器内部的 ufw 已经配好并验证。云安全组和 ufw 是两层门禁，两层都开才通。
**这一步已完成。** 根因是规则组建好后没有绑定到 VPS 实例，绑定后立刻生效。
80、443、3100 从 4 秒超时变成快速拒绝（80、443 没有服务监听），3100 返回 200。
公网现在能打开站点。

## 2. 在 B2 桶加一条 CORS 规则

后台上传报错的根因在这一步。`src/payload.config.ts` 开了 `clientUploads: true`，
Payload 先签发一个预签名 PUT URL，再让**浏览器直接跨域 PUT 到 B2**。这个 PUT 带
`Content-Type`、`If-None-Match` 等自定义头，属于非简单请求，浏览器会先发 `OPTIONS`
预检；桶上没有 CORS 规则时 B2 回 403 且不带 `Access-Control-Allow-Origin`，浏览器
就把真正的 PUT 拦下来，页面只看到 `TypeError: Failed to fetch`。

> **后台上传有两个独立的坑，本节先讲第一个。** ① CORS 预检 `403`（本节，改 B2 桶规则）；
> ② 预检过了、真正的 `PUT` 仍回 `501 Not Implemented`（Payload 为修 CVE-2026-105867
> 把 `If-None-Match: *` 硬编码进预签名 PUT，B2 不实现条件写，改
> `src/lib/s3/b2-client-uploads.ts`，见本节末「第二层」）。两个都修好才能传图，
> 而且必须先修 CORS 才会暴露第二个。**注意：**曾误判为 AWS SDK 校验和参数，
> 已用真实 B2 探针推翻——B2 其实容忍 `x-amz-checksum-crc32`，关掉它治不了 501。

我做过一次不带凭据的只读预检：

```bash
curl -i -X OPTIONS 'https://koduckya.s3.us-west-004.backblazeb2.com/media/__probe__.png' \
  -H 'Origin: http://153.115.43.228:3100' \
  -H 'Access-Control-Request-Method: PUT' \
  -H 'Access-Control-Request-Headers: content-type, if-none-match'
```

返回 `403` + `CORSResponse: CORS is not enabled for this bucket.`。
关于「桶上有没有规则」，前后两次查到的结果不一样，以 **2026-11-09 用 B2 CLI 读回的为准**：
早先 B2 原生只读接口看到 `corsRules: []`（`b2_get_bucket` 返回 `null`），
但后来 `b2 bucket get koduckya` 看到桶上已有两条 `["*"]` 来源的**下载**规则
（`downloadFromAnyOrigin`、`s3DownloadFromAnyOrigin`，操作只有
`b2_download_*` / `s3_head` / `s3_get`）。**没有 `s3_put`**，所以 PUT 预检依然 403。

B2 按**第一条** origin 匹配的规则生效，这两条 `["*"]` 规则会先截住预检，
因此上传规则必须排在第一位。`b2 bucket update --cors-rules` 是**整体替换**，
不是追加：提交时必须把现有规则一并带上，只发下面那一条会把已有下载能力冲掉。
实操顺序是先 `b2 bucket get koduckya` 读回，把新规则插到数组开头，再整体提交。

报错出在预检 OPTIONS，不是 PUT 本身失败，也不是密钥、`S3_ENDPOINT` 或签名配错。
`signedDownloads: true` 的 302 签名下载走自己的 `/api/media/file/...`，前台读图不跨域，
不需要为它放开 GET。

### 规则内容

**2026-11-09 已按方案 1 在 `koduckya` 桶落地并验证通过**，下面这段是最终生效的规则。
如果以后要重配，注意它是三条规则组成的数组（见上面「整体替换 / 顺序」的说明），
单独贴第一条会冲掉原有两条下载规则。

**`allowedOperations` 必须用 `s3_*` 小写操作名，不能写 `PUT` / `GET` / `POST` / `HEAD`。**
`allowedOperations` 是 B2 原生接口（`b2_update_bucket` / B2 CLI）的字段，取值是
`s3_put`、`s3_get`、`s3_head`、`s3_post`、`s3_delete` 这类操作名；`PUT` 那套是 S3
`PutBucketCors` 里 `AllowedMethods` 的词汇。两套 API 的词汇不能混用，混了两边都不认。
**这一节早先给的是错的 `["GET", "PUT", "POST", "HEAD"]`，照抄不会生效。**

最终生效的完整数组（三条，`card-market-vps` 排第一）：

```json
[
  {
    "corsRuleName": "card-market-vps",
    "allowedOrigins": [
      "https://card-market-nextjs.vercel.app",
      "http://153.115.43.228:3100",
      "http://localhost:3100",
      "http://127.0.0.1:3100"
    ],
    "allowedOperations": ["s3_put", "s3_get", "s3_head"],
    "allowedHeaders": ["*"],
    "exposeHeaders": ["ETag"],
    "maxAgeSeconds": 3600
  },
  {
    "corsRuleName": "downloadFromAnyOrigin",
    "allowedOrigins": ["*"],
    "allowedOperations": ["b2_download_file_by_id", "b2_download_file_by_name"],
    "allowedHeaders": ["authorization", "range"],
    "exposeHeaders": null,
    "maxAgeSeconds": 3600
  },
  {
    "corsRuleName": "s3DownloadFromAnyOrigin",
    "allowedOrigins": ["*"],
    "allowedOperations": ["s3_head", "s3_get"],
    "allowedHeaders": ["authorization", "range"],
    "exposeHeaders": null,
    "maxAgeSeconds": 3600
  }
]
```

- `s3_put` 是修这个报错的那一条，另外两个只是余量，删掉不影响上传。
- `allowedOrigins` 要写完整 origin（含端口），不带路径、不带结尾斜杠。后两条是本地
  `next dev` 和第 6 节那条 SSH 隧道进后台时用得上的。
- `allowedHeaders` 必须是**单独一个 `"*"`**：AWS SDK v3 会带 `x-amz-checksum-crc32`、
  `x-amz-sdk-checksum-algorithm` 这类头，逐个枚举容易漏。预检要求 origin、操作名、
  以及每个被请求的头全部匹配才放行。
- 后两条是桶上原有的下载规则，原样保留。`b2` 读回时 `exposeHeaders` 会小写成
  `etag`、操作顺序也会重排，属于 B2 自己的归一化，不影响语义。
- 单条规则上限 1000 字节，一个桶最多 100 条。

### 怎么应用（已执行）

本机已装 B2 CLI 5.0.2。**不要把密钥贴到聊天里**——`.env` 里的 `S3_KEY` / `S3_SECRET`
就是 B2 的 applicationKeyId / applicationKey，用环境变量传给 CLI，密钥不进命令行：

```bash
# 授权（只需一次；也支持 B2_APPLICATION_KEY_ID / B2_APPLICATION_KEY 环境变量）
b2 account authorize

# 先读回现状，务必把已有规则一起带进新数组
b2 bucket get koduckya > /tmp/b2-bucket-before.json

# 把上面三条规则的 JSON 存成 /tmp/b2-cors-rules.json，再整体提交
b2 bucket update --cors-rules "$(< /tmp/b2-cors-rules.json)" koduckya allPrivate
```

末尾的 `allPrivate` 别漏——这条命令会一并提交 bucketType，写成 `allPublic` 会把桶改公开。
老版 CLI 是 `b2 update-bucket --corsRules ...`；先跑 `b2 bucket update --help`
确认你装的版本。建议先 `jq . /tmp/b2-cors-rules.json` 验一下格式，
B2 的报错大多是 JSON 不合法。

Web 控制台在 Backblaze B2 → Buckets → 选桶 → Bucket Settings → CORS Rules。
**如果那里只给「单一来源 / 全部来源」这种简版预设、不让填操作名，就必须用 B2 CLI 或
S3 兼容 API** —— 简版规则写不出 `s3_put`，也不会保留已有规则。
本次走的是 B2 CLI 方案，没有用控制台。

也可以走 S3 兼容 API，**这里反过来要写 `PUT`**（用的是 S3 的 `AllowedMethods`）。
把下面这段存成 `/tmp/cors.json`：

```json
{
  "CORSRules": [
    {
      "ID": "card-market-vps",
      "AllowedOrigins": ["https://card-market-nextjs.vercel.app", "http://153.115.43.228:3100", "http://localhost:3100", "http://127.0.0.1:3100"],
      "AllowedMethods": ["PUT", "GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

```bash
aws s3api put-bucket-cors \
  --endpoint-url https://s3.us-west-004.backblazeb2.com \
  --bucket koduckya \
  --cors-configuration file:///tmp/cors.json
```

`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` 用现有的 `S3_KEY` / `S3_SECRET`。
两种写法等价，挑一种，别把字段名混着抄。

**桶保持 Private，不要点 Public。** 项目用私有桶加签名下载，设成公开反而会触发
Backblaze 要求绑定信用卡。CORS 不是授权：预签名 URL 的签名照旧要验，CORS 只是告诉
浏览器「允许读这个响应」。

### 验证（2026-11-09 已通过）

`b2 bucket get koduckya` 读回三条规则、桶仍是 `allPrivate`。不带凭据的 OPTIONS 预检：

| 场景 | 结果 |
| --- | --- |
| `http://153.115.43.228:3100` + PUT + checksum 头 | `200`，`Access-Control-Allow-Methods: PUT`，四个请求头全放行 |
| `http://localhost:3100` + PUT | `200` |
| `https://evil.example.com` + PUT | `403 This CORS request is not allowed.`（白名单外仍拒绝） |
| `http://153.115.43.228:3100` + GET + `range` | `200`，原有下载规则未被冲掉 |

CORS 只解决了浏览器肯发请求；`/admin` 重传大图当时仍在真正的 `PUT` 上失败，
见下面「第二层」。两层都修好后，重传成功才是端到端生效。
若用 S3 兼容 API，可用
`aws s3api get-bucket-cors --endpoint-url https://s3.us-west-004.backblazeb2.com --bucket koduckya`
读回规则确认。

### 第二层：真正的 PUT 回 501，不是 CORS、也不是校验和

预检改 200 后，`/admin` 上传大图的真正 `PUT` 仍报
`501 (Not Implemented)` / `Error: Upload failed with status 501`。B2 的响应体原文是
`A header you provided implies functionality that is not implemented If-None-Match`。

**根因。** `@payloadcms/storage-s3` 从 3.90.0 起为修
CVE-2026-105867（clientUploads 可能覆盖已有对象），在 `generateSignedURL.js` 里把
`IfNoneMatch: '*'` 硬编码进预签名的 `PutObjectCommand`，并把
`'If-None-Match': '*'` 作为浏览器请求头一并返回——这就是 S3 的「条件写」。
B2 的 S3 兼容 API **不实现条件写**，收到这个头直接回 501。这跟 CORS、密钥、
`S3_ENDPOINT` 都无关：预检已过说明请求到了 B2，是 B2 拒绝了头本身。

两个容易走偏的点，都已用真实 B2 探针逐一排除：

- **不是 AWS SDK 校验和。** URL 里的 `x-amz-checksum-crc32` /
  `x-amz-sdk-checksum-algorithm=CRC32` 是 SDK v3 ≥3.729 的默认行为，但 B2 其实容忍：
  带 checksum、**不带** `If-None-Match` → `200`；设 `WHEN_REQUIRED` 去掉 checksum、
  **保留** `If-None-Match` → 仍 `501`。所以那两个开关无害但治不了本，已撤掉。
- **不能只删浏览器头。** `if-none-match` 被签进了 `X-Amz-SignedHeaders`
  （`content-type;host;if-none-match`）。只把浏览器发的 `If-None-Match` 去掉、沿用
  原签名 URL，B2 会回 `400 InvalidRequest: header 'if-none-match' is listed in
  signed headers, but is not present`。必须连命令一起重签。

`IfNoneMatch` 是硬编码在命令里的，`s3Storage({ config })` 传不进去；npm 最新的
3.93.0 仍硬编码、也没有 B2 兼容开关，升级无解。另一条路是关掉 `clientUploads` 走
服务端上传（实测 `putObject` 对 B2 返回 200），但那会推翻 Vercel 4.5MB 绕行和
刚配好的 CORS 直传方案，不采用。

**已落地修法。** 新增 [src/lib/s3/b2-client-uploads.ts](../src/lib/s3/b2-client-uploads.ts)，
在 [payload.config.ts](../src/payload.config.ts) 里排在 `s3Storage` 之后（`order: 1`）
挂一个配置插件，包住 `/storage-s3-generate-signed-url` 端点：先让上游 handler 照常
跑完鉴权、`randomUUID()` 唯一 Key 与签名回执，再从它签好的 URL 里取出**同一个对象
Key**，重签一张不带 `IfNoneMatch` 的 PUT URL，并换掉浏览器头里的 `If-None-Match`。
对象位置、`clientUploadContext` / 回执、文档引用全部不变，只换签名。两个 AWS SDK 包
已作为显式依赖写进 `package.json`，避免 Docker 的 `npm ci` 依赖提升落空。

安全取舍要如实说：去掉条件写等于少一层「服务端强制不覆盖」的纵深防御。本项目仍
保留上游的防覆盖主体——`resolveSignedURLKey` 每次上传生成 `randomUUID()` 段作为 Key，
`createClientUploadReceipt` 把 collection / filename / 用户 / 6 小时过期签进回执，客户端
无法指定 Key；`assertClientUploadAccess` 的权限校验也照常执行。插件内部还会检测上游
是否仍在签 `if-none-match`，**上游哪天去掉（或 B2 支持条件写）就自动空转**，
到时直接删掉这个 shim 即可。

**验证。** `npx tsc --noEmit`、`npx next build` 均通过；用落地插件本身对真实 B2 发 PUT：
签名头从 `content-type;host;if-none-match` 变 `content-type;host`、浏览器头无
`If-None-Match`、同一对象 Key（含中文/空格/`&`/`%`）真 PUT `200`、GET 命中、
cleanup `204`，自动失效与错误透传分支也都通过。
**代码改完要重新部署才生效**（VPS 上 `docker compose build app && docker compose up -d app`，
不像 `.env` 那样是运行时变量），之后在 `/admin` 重传一张大图做端到端确认。

域名上线后按 [07 文档第 5 步](07-domain-cloudflare-caddy.md) 把 https 域名加进
`allowedOrigins`、删掉 IP 和 localhost。

官方参考：[CORS 规则](https://www.backblaze.com/docs/cloud-storage-cross-origin-resource-sharing-rules)、
[用 B2 CLI 开启 CORS](https://www.backblaze.com/docs/cloud-storage-enable-cors-with-the-cli)、
[b2_update_bucket](https://www.backblaze.com/apidocs/b2-update-bucket)、
[S3 Put Bucket CORS](https://www.backblaze.com/apidocs/s3-put-bucket-cors)。

## 3. 把 Xserver PostgreSQL 的连接信息给我

需要五样东西，在面板的 `データベース` 或「接続情報」页里能找到。

1. 主机名或 IP
2. 端口，通常是 5432
3. 数据库名
4. 用户名和密码
5. 是否要求 SSL 连接

这一节已经办完，不需要你再做任何事。数据库连接已验证通过，
不需要加白名单。VPS 内网 IP 是 `172.16.0.3`，TCP 5432 在 5.6 毫秒内连通。
我先前用 `postgres/postgres` 试探被 `pg_hba.conf` 拒绝，
误判成来源 IP 没授权。换成面板给的 `koduckya` 账号后直连成功，
所以那一步是我判断错了。

这个库是 PostgreSQL 16.14，没开 SSL。`sslmode=require` 会报
`server does not support SSL`，连接串结尾不要加它。
Neon 的数据已经导入，23 张表和业务数据都校验通过。

**不要把密码贴在聊天里。** 在你自己电脑的终端执行下面这条命令，
把中文部分换成面板上的真实值，然后告诉我一声，我从服务器读这个文件。

```bash
ssh root 'umask 077; cat > /root/.card-market-db <<"EOF"
postgresql://用户:密码@172.16.3.42:5432/库名
EOF
chmod 600 /root/.card-market-db'
```

如果面板给的是分开的字段而不是一条连接串，把字段分别写在文件里也行，我来拼。
密码里如果有 `@`、`:`、`#`、`/` 这类字符，先原样写，我来处理 URL 编码。

我拿到后先在 VPS 上测连通，再写进生产 env 文件。那个文件权限是 `600`，
不进 Git，也不会进 Docker 镜像。

## 4. 已经验证过的结果

`docker compose config` 解析、镜像构建、`/api/health` 真实查库、
首页、后台、`/api/cards`、三语路由、两张图片，全部在服务器内验证通过。
`app` 容器状态是 healthy，镜像里确认没有 `.env`。
公网 3100 访问这一步还等你放行端口，我会在放行后立刻复测。

## 找不到怎么办

- 菜单名称对不上，把面板截图发我。
- 端口放行了还是不通，可能是安全组和 ufw 只开了一层，我帮你逐层测。
- 数据库连接失败，先查账号、库名和 SSL 参数，我会在 VPS 上直接测并告诉你差哪一步。

## 5. 上线后怎么看监控面板

两个面板只绑在服务器本机，公网访问不到，这是故意的。在你自己电脑上开一条
SSH 隧道，把服务器端口映射到本地：

```bash
ssh -L 8080:127.0.0.1:8080 -L 3001:127.0.0.1:3001 root -N
```

这条命令不输出内容，保持窗口开着就行。然后浏览器打开
`http://127.0.0.1:8080` 看 Dozzle 实时日志，`http://127.0.0.1:3001` 看 Uptime Kuma。
第一次进 Uptime Kuma 会让你建管理员账号。建好之后加两个监控项，
`http://127.0.0.1:3100/api/health` 检查 HTTP 200 和关键字 `ok`，
再加一个站点首页。然后接一个告警渠道，Telegram、Discord 或邮件都行。

按 `Ctrl+C` 关掉隧道。面板不用一直开着，告警会主动推给你。

## 6. 规则已经加了，公网还是打不开（已解决）

**根因。** 规则组在 Xserver 面板里建好了，但没有绑定到 VPS 实例。
绑定之后立刻生效。现在公网全部打通，`http://153.115.43.228:3100` 的首页、
后台、`/api/cards`、三语路由和图片都实测 200。

下面保留当时的排查过程，供以后遇到同类问题参考。

我做了逐层排查，结论不是服务器配置的问题。

- 服务器内部 `/api/health` 是 200，首页 0.06 秒就返回。
- ufw 已放行 80、443、3100，IPv4 和 IPv6 都有。
- `docker-proxy` 监听 `0.0.0.0:3100`。
- 在服务器上抓包，22 端口能抓到 SYN 和 SYN/ACK，TCP 连接 270 毫秒成功。
  同一段时间里 80、443、3100 一个 SYN 包都没有，iptables 计数也不变。
- 抓包里能看到公网 IP 被 NAT 成内网 `172.16.0.3`，22 端口证明 NAT 本身是好的。

所以三条规则是整体没生效，不是某个端口写错。请在 Xserver 面板确认这几项。

1. 规则是否需要点「設定を反映」「適用」之类的按钮，或者需要重启 VPS 才生效。
2. 「ファイアウォール」的总开关是否打开，有没有另一套独立的「パケットフィルタ」设置。
3. 规则方向是入站（インバウンド／受信）还是出站。
4. 规则是否绑定到了这台 VPS 实例和正确的网卡。
5. 有没有一条默认拒绝规则排在放行规则前面。

22 端口能通是平台默认放行 SSH，不代表你新加的规则已经生效。

**先做一个判别实验。** 关掉 WiFi，用手机蜂窝网络打开
`http://153.115.43.228:3100`。手机能通，说明是我这边出口网络拦了端口；
手机也不通，就是 Xserver 那层。抓包只能证明包没到服务器网卡，
分不清是云平台丢了还是中间网络丢了，这一步能把两者分开。

我还试过从服务器自己连自己的公网 IP，22 端口也超时。云环境的 hairpin NAT
通常不回环，所以那条路径是无效测试，不作为证据。

上面五项排查点来自通用经验。我尝试查 Xserver 官方文档确认有没有「設定を反映」
这类步骤，搜索工具超时了，所以它们不是官方步骤，请以面板实际界面为准。

**临时验收办法。** 在你自己电脑上开一条 SSH 隧道，不用等面板修好：

```bash
ssh -L 3100:127.0.0.1:3100 root -N
```

然后浏览器打开 `http://127.0.0.1:3100`。我实测 `/api/health`、首页、后台都是 200。
隧道下首页要 11.7 秒，服务器上只要 0.06 秒，慢的是跨境网络加单条隧道，
不是应用本身。公网规则生效后我会重新测。
