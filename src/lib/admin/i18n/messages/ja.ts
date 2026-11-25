/**
 * 后台自有界面的日语文案。这里也是键的「基准」：
 * zh / en 两个文件用 Record<AdminMessageKey, string> 约束，漏一条就 typecheck 失败。
 *
 * 键用「区域.用途」的扁平写法，插值统一用 {name}。后台默认语言是日语，
 * 所以日语写在第一份、也作为兜底。
 */
export const ja = {
  'nav.dashboard': 'ダッシュボード',
  'nav.noDeduction': '減額なし買取',
  'nav.bulkCards': '一括出品',
  'nav.help': 'ヘルプ',
  'nav.logout': 'ログアウト',
  'nav.filter': 'コレクションを絞り込む',
  'nav.noMatches': '一致するコレクションがありません',

  'theme.toLight': 'ライトモードに切り替え',
  'theme.toDark': 'ダークモードに切り替え',

  'meta.titleSuffix': 'カード買取サイト | Payload',
  'login.title': 'カード買取サイト · コンテンツ管理',

  'password.show': 'パスワードを表示',
  'password.hide': 'パスワードを隠す',

  'status.unknown': '不明',
  'status.published': '公開中',
  'status.draft': '下書き',
  'status.archived': 'アーカイブ',

  'dashboard.overview': '概要',
  'dashboard.lead': 'カード、分類、バナー、お知らせ、店舗、お問い合わせの運用入口です。',
  'dashboard.viewSite': 'サイトを表示',
  'dashboard.newCard': 'カードを新規作成',
  'dashboard.stats.cards': 'カード',
  'dashboard.stats.cardsHint': '公開中: {count}',
  'dashboard.stats.announcements': 'お知らせ',
  'dashboard.stats.announcementsHint': '公開中: {count}',
  'dashboard.stats.pending': '未対応のお問い合わせ',
  'dashboard.stats.pendingHint': '全 {count} 件。対応後は「対応済み」に変更',
  'dashboard.stats.shops': '店舗',
  'dashboard.stats.shopsHint': '公開中: {count}',
  'dashboard.recent': '最近の更新',
  'dashboard.allCards': 'すべてのカード',
  'dashboard.recentDesc': '更新日時の新しい順。名前をクリックすると編集画面が開きます。',
  'dashboard.noCardsBefore': 'まだカードがありません。まずは',
  'dashboard.noCardsAction': '1枚作成',
  'dashboard.noCardsAfter': 'してください。',
  'dashboard.table.card': 'カード',
  'dashboard.table.code': '品番',
  'dashboard.table.price': '価格',
  'dashboard.table.status': 'ステータス',
  'dashboard.table.updated': '更新日時',
  'dashboard.pendingTitle': '未対応のお問い合わせ',
  'dashboard.pendingBadge': '{count} 件',
  'dashboard.pendingDesc': 'ステータスが「新規」のお問い合わせです。',
  'dashboard.pendingEmpty': '未対応のお問い合わせはありません。',
  'dashboard.anonymous': '匿名',
  'dashboard.quick': 'クイック操作',
  'dashboard.quickDesc': 'よく使う操作をまとめました。',
  'dashboard.quick.newCard': 'カードを新規作成',
  'dashboard.quick.announcement': 'お知らせを書く',
  'dashboard.quick.media': '素材をアップロード',
  'dashboard.quick.messages': 'お問い合わせを処理',
  'dashboard.quick.settings': 'サイト設定',
  'dashboard.collections': 'コンテンツコレクション',
  'dashboard.collectionsDesc': 'グループ別のすべてのコレクションとグローバル設定。',
  'dashboard.collectionsEmpty': 'このアカウントで閲覧できるコレクションはありません。',
  'dashboard.create': '新規作成',
  'dashboard.signedInAs': 'ログイン中: {email}',

  'entity.announcements': 'お知らせ: ピン留め・予約公開',
  'entity.banners': 'トップのカルーセルとリンク先',
  'entity.cards': '商品本体: 名称・品番・価格・画像・説明',
  'entity.bulkCards': '複数のカード画像を一括アップロードしてカードを作成',
  'entity.cardStatuses': 'カード状態と表示順・バッジ色',
  'entity.infoPages': '審査用の固定情報ページ',
  'entity.ips': 'カードが属するIP・大分類',
  'entity.media': '画像素材（カード・バナー・店舗写真）',
  'entity.messages': 'お問い合わせチケット: 新規 / 対応済み / アーカイブ / スパム',
  'entity.noDeduction': '減額なし買取カードの一覧。ドラッグでトップの表示順を変更',
  'entity.rarities': 'レアリティと表示順',
  'entity.roles': '管理画面のロールとモジュール権限',
  'entity.series': 'IPに属するシリーズ',
  'entity.siteSettings': 'サイト名・連絡先・共通文言',
  'entity.shops': '店舗: 住所・営業時間・地図座標',
  'entity.subSeries': 'シリーズに属するサブシリーズ',
  'entity.users': '管理画面のアカウントとロール',

  'link.notSet': 'リンク未設定',
  'pattern.home': 'トップページ',
  'pattern.cards': 'カード一覧（フィルター付き可、下記参照）',
  'pattern.card': 'カード詳細',
  'pattern.announcements': 'お知らせ一覧',
  'pattern.announcement': 'お知らせ詳細',
  'pattern.shops': '店舗一覧',
  'pattern.message': 'お問い合わせページ',
  'pattern.info': '情報ページ（4つの固定キー）',

  'help.pageTitle': '管理画面ヘルプ',
  'help.lead':
    'このページでは、日常業務でつまずきやすいポイントをまとめています。判断に迷ったら、まず「リンクの追加方法」と「画像サイズの目安」を確認してください。',
  'help.toc': '目次',
  'help.copyHint': '一覧ページの「リンク」列の小さなボタンを押すとコピーできます。',
  'help.imagesHint': '画像は「素材」コレクションでアップロードし、コンテンツ側で選択してください。',
  'help.linksHint':
    'リンクが正しいか確認するときは、組み立てたパスをブラウザで開いてからバナーに入力してください。',
  'help.back': 'ダッシュボードに戻る',
  'help.table.page': 'ページ',
  'help.table.example': 'リンク例',

  'help.links.title': 'リンクの追加方法',
  'help.links.intro':
    'バナーの「リンク先」は手入力のテキストボックスで、管理画面では検証されません。サイト内パス（/ で始まる）を入力し、ドメインは含めないでください。フロント側が日本語サイトに /ja、英語サイトに /en を自動で補うため、同じリンクを3言語分作る必要はありません。',
  'help.links.step1.title': '方法1: 一覧ページからコピー',
  'help.links.step1.body':
    'カード、お知らせ、店舗、情報ページの一覧を開きます。対象の行にある「リンク」列の小さなボタンを押すと、そのレコードのサイト内パスとコピーボタンが表示されます。コピーして、バナーのフォームの「リンク先」に貼り付けてください。',
  'help.links.step2.title': '方法2: 詳細ページからコピー',
  'help.links.step2.body':
    '任意のレコードを開くと、ブラウザのアドレスバーに .../admin/collections/cards/123 と表示されます。最後の数字がそのレコードの ID です。フロントの詳細ページは {cardExample} のような形式になります。',
  'help.links.step3.title': '外部リンク',
  'help.links.step3.body':
    '別サイトへ飛ばす場合は、https://example.com のような完全な URL を入力してください。http で始まる URL には言語パスが付きません。',

  'help.patterns.title': '入力できるリンク',
  'help.patterns.intro':
    'このサイトのフロントに存在するページの一覧です。数字の ID が付いているものは、その ID をご自身のレコードの ID に置き換えてください。',

  'help.filters.title': '「絞り込み済み一覧」へのリンク',
  'help.filters.intro':
    'カード一覧 /cards の絞り込み結果もリンクとして使えます。条件は ? の後に書き、複数ある場合は & でつなぎます。よく使う例:',
  'help.filters.ip.title': 'IP別',
  'help.filters.ip.body': '{origin}/cards?ip=3',
  'help.filters.series.title': 'シリーズ + 並び順',
  'help.filters.series.body': '{origin}/cards?series=5&sort=price_asc',
  'help.filters.highValue.title': '高額買取のみ',
  'help.filters.highValue.body': '{origin}/cards?hv=1',
  'help.filters.price.title': '価格帯',
  'help.filters.price.body': '{origin}/cards?min=1000&max=50000',
  'help.filters.keyword.title': 'キーワード + 新着順',
  'help.filters.keyword.body': '{origin}/cards?q=ピカチュウ&sort=newest',

  'help.images.title': '画像サイズの目安',
  'help.images.banner.title': 'トップのバナー画像',
  'help.images.banner.body':
    '1920 × 900（約 2.13:1）を推奨します。バナーサイズのサムネイルは自動で切り出されるため、横長画像はこの比率から極端に外れないようにしてください。被写体が切れやすくなります。',
  'help.images.card.title': 'カード画像',
  'help.images.card.body':
    'カードは一覧・詳細ページで 3:4 の縦画像として表示されます。800 × 800 以上を推奨します（正方形も使用できますが、中央から 3:4 に切り取られます）。1枚あたり 2MB 以下を目安にしてください。',
  'help.images.shop.title': '店舗写真',
  'help.images.shop.body':
    '店舗のメイン画像は大きく表示されます。横 16:9、幅 1200px 以上を推奨します。',
  'help.images.alt.title': '代替テキスト（alt）は必須',
  'help.images.alt.body':
    'すべての画像に alt を入力してください。検索エンジンに読まれるほか、スクリーンリーダーでも読み上げられます。「ピカチュウ 25周年記念カード 表面」のように、内容が分かる一文を書いてください。',

  'help.bulk.title': '一括出品',
  'help.bulk.intro':
    '複数のカード画像をまとめてアップロードし、1枚ずつカード情報を入力するショートカットページです。左メニューの「商品 → 一括出品」から開けます。アカウントには「カード」と「画像」の作成権限の両方が必要です。',
  'help.bulk.upload.title': '画像をアップロード',
  'help.bulk.upload.body':
    '「ファイルを追加」を押すか、画像を左側のエリアにドラッグしてください。自動で直接アップロードされ、進捗が表示されます。代替テキストはファイル名が初期値になり、右側で変更できます。',
  'help.bulk.fill.title': '分類を一括入力',
  'help.bulk.fill.body':
    '「分類を一括入力」を開き、IP、シリーズ、サブシリーズ、レアリティ、公開状態をまとめて選んでから「未保存の画像に適用」を押します。まだ保存していない画像だけが対象で、保存済みのカードは変更されません。',
  'help.bulk.save.title': '1枚ずつ保存',
  'help.bulk.save.body':
    '左側の画像を選び、カード名などの必須項目を入力します。保存に成功すると通知が出て、次の未入力画像へ自動で移動します。保存済みのカードを編集すると、ボタンは「カードを更新」に変わります。左側の一覧では「保存済み」と「未入力」で進捗が分かります。',
  'help.bulk.keys.title': 'ショートカット',
  'help.bulk.keys.body':
    '⌘/Ctrl + Enter で現在のカードを保存、Alt + ←/→ で画像を切り替えます。未保存の内容がある状態で閉じる・再読み込みすると確認が出ます。',
  'help.bulk.dup.title': '品番の重複',
  'help.bulk.dup.body':
    '同じ IP / シリーズ / サブシリーズの組み合わせでは、品番を重複させられません。エラーは「品番」の下に表示されるので、番号を変えて再保存してください。',

  'help.status.title': 'ステータスと公開',
  'help.status.draft.title': '下書きはフロントに表示されません',
  'help.status.draft.body':
    '新規コンテンツは初期状態が「下書き」で、フロントには表示されません。確認が済んだらステータスを「公開中」に変更してください。数秒でフロントに反映されます。アーカイブは公開を止めつつ記録を残す場合に使います。',
  'help.status.schedule.title': 'お知らせは予約公開できます',
  'help.status.schedule.body':
    'お知らせの「公開日時」に未来の日時を入れると予約公開になります。時刻になると自動で公開されるため、待機する必要はありません。空欄の場合はすぐに表示されます。',

  'help.code.title': 'カードの品番は一意である必要があります',
  'help.code.body':
    '同じ IP、シリーズ、サブシリーズの組み合わせでは、カードの品番を重複させられません。重複して保存すると「同じ IP / シリーズ / サブシリーズの組み合わせで品番が既に存在します」とエラーになります。品番を変更して再保存してください。',

  'help.taxonomy.title': 'カード分類の3段階選択',
  'help.taxonomy.intro':
    'カード編集時、「IP / 大分類 → シリーズ → サブシリーズ」は段階的に絞り込まれます。下位のプルダウンには、上位で選んだ項目に属する内容だけが表示されます。大きい分類から順に選べば、3段階を一度に探す必要はありません。',
  'help.taxonomy.order.title': 'まず大分類、次に小分類',
  'help.taxonomy.order.body':
    '「IP / 大分類」を選ぶ前でも「シリーズ」と「サブシリーズ」は押せますが、押すと先にどの項目を選ぶ必要があるかが表示されます。フィールドの下にも同じ説明が常時表示されます。',
  'help.taxonomy.clear.title': '大分類を変えると小分類はクリアされます',
  'help.taxonomy.clear.body':
    '「IP / 大分類」を変えると、選択済みの「シリーズ」と「サブシリーズ」が自動でクリアされ、通知が1回表示されます。「シリーズ」を変えた場合は「サブシリーズ」がクリアされます。IPをまたいだ不整合な組み合わせを保存しないための動作です。クリア後に選び直してください。',
  'help.taxonomy.empty.title': 'プルダウンが空のとき',
  'help.taxonomy.empty.body':
    'プルダウンには、現在の上位項目に属する内容だけが表示されます。上位が正しいのに選択肢がない場合は、「分類」で該当するシリーズ / サブシリーズが作成済みで、有効になっているか確認してください。',

  'help.sort.title': '並び順（sort）',
  'help.sort.body':
    'バナー、店舗、IP、シリーズなどには並び順フィールドがあります。数値が小さいほど前に表示されます。空欄または 0 の場合は既定の順序（通常は新しい順）になります。',

  'help.delete.title': '削除は元に戻せません',
  'help.delete.body':
    '削除は完全削除です。カードやお知らせを削除すると、フロントはすぐに 404 になり、管理画面からも復元できません。不要だと確信できる場合だけ削除し、迷う場合は「アーカイブ」に変更してください。',

  'help.locale.title': 'コンテンツは1言語分だけ',
  'help.locale.body':
    '管理画面のタイトル、本文、説明は1つだけです。フロントはユーザーの言語（/ja、/en）に合わせて UI の文言を切り替えますが、コンテンツ自体を3言語分用意する必要はありません。',
  'status.scheduledPrefix': '予約 · ',
  'status.updated': '「{label}」に変更しました',
  'status.updateFailed': 'ステータスの更新に失敗しました。もう一度お試しください',
  'status.changeLabel': 'ステータスを変更（現在: {label}）',
  'status.choose': 'ステータスを選択',

  'link.copied': 'コピーしました: {href}',
  'link.copyFailed': 'コピーに失敗しました。パスを選択して手動でコピーしてください',
  'link.unpublishedConfirm':
    'このレコードは未公開のため、フロントでは表示されません（開くと 404 になります）。それでも開きますか？',
  'link.copyHref': '{href} をコピー',
  'link.copiedShort': 'コピー済み',
  'link.copyLink': 'リンクをコピー',
  'link.open': 'リンクを開く',
  'link.openUnpublished': 'リンクを開く（未公開）',
  'link.unpublishedHint': '未公開のためフロントでは表示されません',

  'taxonomy.filteredHint': '選択した「{parent}」の{field}のみ表示しています',
  'taxonomy.clearHint': '「{field}」を変更すると、選択済みの下位分類がクリアされます',
  'taxonomy.chooseFirst': '先に「{missing}」を選択してから「{field}」を選択してください',
  'taxonomy.cleared': '「{field}」を変更したため、下位分類をクリアしました。選び直してください',

  'map.searchPlaceholder': '住所を検索して Enter で移動',
  'map.searching': '検索中…',
  'map.search': '検索',
  'map.hint': '地図をクリックするかマーカーをドラッグして選択。現在の座標 {lat}, {lng}',

  'force.title': 'ご自身のパスワードを設定してください',
  'force.desc':
    '管理者が初期パスワードを発行しました。セキュリティのため、初回ログイン時にご自身のパスワードへ変更するまで管理画面には入れません。',
  'force.newPassword': '新しいパスワード',
  'force.confirmPassword': '新しいパスワード（確認）',
  'force.tooShort': 'パスワードは6文字以上にしてください',
  'force.mismatch': 'パスワードが一致しません',
  'force.failed': '変更に失敗しました。もう一度お試しください',
  'force.submitting': '送信中…',
  'force.submit': '変更して管理画面へ',

  'common.pleaseSelect': '選択してください',
  'common.selectIpFirst': '先に IP を選択',
  'common.selectSeriesFirst': '先にシリーズを選択',

  'bulk.cardName': 'カード名',
  'bulk.cardNamePlaceholder': '例: ピカチュウ',
  'bulk.alt': '代替テキスト',
  'bulk.ip': 'IP / 大分類',
  'bulk.series': 'シリーズ',
  'bulk.subSeries': 'サブシリーズ',
  'bulk.rarity': 'レアリティ',
  'bulk.cardStatus': 'カード状態',
  'bulk.code': '品番',
  'bulk.codePlaceholder': '例: 123/197',
  'bulk.price': '買取価格',
  'bulk.pricePlaceholder': '例: 320',
  'bulk.publishStatus': '公開状態',
  'bulk.highValue': '高額買取',
  'bulk.noDeduction': '減額なし買取',
  'bulk.stopBuyback': '買取停止',
  'bulk.description': '説明',
  'bulk.descriptionPlaceholder': '任意。改行で段落を分けられます。',
  'bulk.updating': '更新中…',
  'bulk.saving': '保存中…',
  'bulk.updateCard': 'カードを更新',
  'bulk.saveCard': 'カードを保存',
  'bulk.dirty':
    'カード #{id} に未保存の変更があります。「カードを更新」を押して保存してください。',
  'bulk.savedAs': 'カード #{id} として保存しました。',
  'bulk.uploadFirst': '画像のアップロードが完了するまで保存できません。',
  'bulk.shortcuts': '⌘/Ctrl + Enter で保存 · Alt + ←/→ で切り替え',

  'bulk.error.alt': '代替テキストを入力してください',
  'bulk.error.name': 'カード名を入力してください',
  'bulk.error.ip': 'IP / 大分類を選択してください',
  'bulk.error.series': 'シリーズを選択してください',
  'bulk.error.subSeries': 'サブシリーズを選択してください',
  'bulk.error.rarity': 'レアリティを選択してください',
  'bulk.error.cardStatus': 'カード状態を選択してください',
  'bulk.error.price': '買取価格を入力するか、「買取停止」にチェックしてください',
  'bulk.error.priceNumber': '買取価格は 0 以上の数値で入力してください',

  'bulk.file.updating': '更新中',
  'bulk.file.saving': '保存中',
  'bulk.file.updateFailed': '更新失敗',
  'bulk.file.dirty': '変更あり',
  'bulk.file.saved': '保存済み',
  'bulk.file.saveFailed': '保存失敗',
  'bulk.file.queued': '待機中',
  'bulk.file.uploading': 'アップロード {percent}%',
  'bulk.file.processing': '処理中',
  'bulk.file.empty': '未入力',
  'bulk.file.uploadFailed': 'アップロード失敗',
  'bulk.file.imagesOnly': '画像ファイルのみアップロードできます',
  'bulk.file.title': '一括出品',
  'bulk.file.countImages': '画像 {count} 枚',
  'bulk.file.savedCount': '保存済み {count}',
  'bulk.file.pendingCount': '未入力 {count}',
  'bulk.file.addFiles': 'ファイルを追加',
  'bulk.file.dropHere': 'カード画像をここにドラッグ',
  'bulk.file.dropHint': 'または「ファイルを追加」を押して複数選択',
  'bulk.file.listLabel': '未処理の画像一覧',
  'bulk.file.cardTitle': 'カード #{id}',
  'bulk.file.retry': '再試行',
  'bulk.file.removeAria': '{name} を削除',
  'bulk.file.remove': '削除',

  'bulk.apply.title': '分類を一括入力',
  'bulk.apply.hint': '未保存の画像のみが対象です',
  'bulk.apply.noChange': '変更しない',
  'bulk.apply.filled': '未保存の画像 {count} 枚に入力しました',
  'bulk.apply.none': '入力できる未保存の画像がありません',
  'bulk.apply.action': '未保存の画像に適用',

  'bulk.uploadFailed': 'アップロード失敗',
  'bulk.removeConfirm': 'この画像の入力内容はまだ保存されていません。削除しますか？',
  'bulk.deleteMediaFailed': '素材の削除に失敗しました。しばらくしてからもう一度お試しください',
  'bulk.savedToast': '「{name}」をカード #{id} として保存しました',
  'bulk.updatedToast': 'カード #{id}「{name}」を更新しました',
  'bulk.saveFailed': 'カードの保存に失敗しました',
  'bulk.missingTaxonomy': '分類データが不足しています:',
  'bulk.missingTaxonomyAfter':
    '。カードの必須項目を埋められないため、先に分類を追加して有効にしてください。',
  'bulk.pendingImages': '未処理の画像',
  'bulk.cardInfo': 'カード情報',
  'bulk.prev': '前へ',
  'bulk.next': '次へ',
  'bulk.uploaded': '画像をアップロードしました',
  'bulk.uploadHint': 'アップロード後に画像サイズが自動で入ります',
  'bulk.selectImage': '左側の画像を選択してカード情報を入力してください',
  'bulk.unnamedImage': '名称未設定の画像',

  'bulk.err.badSigned': 'アップロード URL の応答形式が正しくありません',
  'bulk.err.badMedia': '素材作成の応答形式が正しくありません',
  'bulk.err.badJson': '応答形式が正しくありません',
  'bulk.err.signedNetwork':
    'アップロード URL の取得に失敗しました。ネットワークを確認してください',
  'bulk.err.noS3':
    'この環境ではオブジェクトストレージへの直接アップロードが無効です。管理者に S3 の設定を依頼してください',
  'bulk.err.uploadAuth':
    'アップロード権限がないか、ログイン状態が切れています。再ログインしてください',
  'bulk.err.signedHttp': 'アップロード URL の取得に失敗しました（HTTP {status}）',
  'bulk.err.uploadHttp': '画像のアップロードに失敗しました（HTTP {status}）',
  'bulk.err.uploadNetwork':
    '画像のアップロードに失敗しました。ネットワークまたはオブジェクトストレージの CORS 設定を確認してください',
  'bulk.err.createNetwork': '素材の作成に失敗しました。ネットワークを確認してください',
  'bulk.err.createAuth':
    '素材を作成する権限がないか、ログイン状態が切れています。再ログインしてください',
  'bulk.err.createHttp': '素材の作成に失敗しました（HTTP {status}）',
  'bulk.err.listSeparator': '、',
  'bulk.err.auth':
    'ログイン状態が切れたか権限が不足しています。再ログインしてからもう一度お試しください',
  'bulk.err.http': '{fallback}（HTTP {status}）',
  'bulk.err.altNetwork':
    '代替テキストの更新に失敗しました。ネットワークを確認してください',
  'bulk.err.altFailed': '代替テキストの更新に失敗しました',
  'bulk.err.updateFailed': 'カードの更新に失敗しました',
  'bulk.err.saveFailed': 'カードの保存に失敗しました',
  'bulk.err.checkNetwork': '{action}。ネットワークを確認してください',
  'bulk.err.saveBadResponse': '保存は成功しましたが、応答形式が正しくありません',

  'validation.buybackFlags':
    '「高価買取」「減額なし買取」「買取停止」は1つだけ選択するか、すべて解除してください',
  'validation.priceRequired':
    '買取価格は必須です。買取を停止する場合は「買取停止」にチェックしてください',
  'validation.messageEmpty': 'メッセージ本文を入力してください',
  'validation.messageTooLong': 'メッセージ本文が長すぎます（2000 文字以内）',
  'validation.singleAdmin':
    'アプリに管理者は1人だけです。管理者ロールの割り当て・変更はできません',
  'validation.deleteAdmin': '唯一の管理者アカウントは削除できません',

  'noDeduction.title': '減額なし買取',
  'noDeduction.hint': 'ドラッグハンドル、または ↑ / ↓ でトップページの表示順を変更できます',
  'noDeduction.count': '全 {total} 枚',
  'noDeduction.order': '並び替え',
  'noDeduction.cardName': 'カード名',
  'noDeduction.code': '品番',
  'noDeduction.sort': '表示順',
  'noDeduction.dragTitle': 'ドラッグして並び替え',
  'noDeduction.moveUp': '上へ移動',
  'noDeduction.moveDown': '下へ移動',
  'noDeduction.moveUpNamed': '「{name}」を上へ移動',
  'noDeduction.moveDownNamed': '「{name}」を下へ移動',
  'noDeduction.saved': '表示順を保存しました',
  'noDeduction.saveFailed': '表示順の保存に失敗しました',
  'noDeduction.saveRowFailed': '{index} 行目の保存に失敗しました',
  'noDeduction.pagination': 'ページ送り',
  'noDeduction.prev': '前へ',
  'noDeduction.next': '次へ',

} as const

export type AdminMessageKey = keyof typeof ja
