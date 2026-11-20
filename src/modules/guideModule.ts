import type { CapabilityReport, ExperienceModule } from '../types';

interface GuideItem {
  id: string;
  order: number;
  category: string;
  title: string;
  subtitle: string;
  description: string;
  steps: string[];
  tip: string;
  diagnostic?: 'webxr';
}

type FilterMode = 'all' | 'todo' | 'done';

const STORAGE_KEY = 'xreal-aura-guide-checklist-v1';

const GUIDE_ITEMS: GuideItem[] = [
  {
    id: 'dimming-5-level',
    order: 1,
    category: '光学・ディスプレイ',
    title: '5段階電子調光',
    subtitle: 'Electrochromic Dimming（透過〜没入の瞬時切替）',
    description:
      'XREAL AURA のレンズに内蔵されたエレクトロクロミック調光により、現実世界がくっきり見える透過状態から、映画・空間作業に集中できる暗室レベルまで5段階で明るさを調整できます。',
    steps: [
      'テンプル（つる）の調光ボタンを短押しして、1段階ずつ透過率を切り替える',
      '明るい窓際や照明の下で、黒背景UI（OLED透過モード）の見え方と文字コントラストを比較する',
      '動画視聴や集中作業時は最大遮光（レベル5）、移動・周囲確認時はレベル1〜2に設定する',
    ],
    tip: 'Micro-OLED は黒（#000000）が発光しないため、低調光＋本アプリの「OLED透過モード」を組み合わせると、現実空間にUIだけが浮かぶAR体験になります。',
  },
  {
    id: 'gemini-ai',
    order: 2,
    category: 'AIアシスタント',
    title: 'Gemini AI呼び出し',
    subtitle: '視界と音声でつながる Android XR マルチモーダルAI',
    description:
      'Android XR に統合された Gemini をいつでも呼び出し、目の前に見えているものについての質問、リアルタイム翻訳、ハンズフリーでの情報検索やウィンドウ操作を行えます。',
    steps: [
      'Compute Puck の専用ボタン長押し、または「Hey Google」の音声コマンドで Gemini を起動する',
      '目の前の物体や画面を見ながら「これについて教えて」「英語に翻訳して」と自然言語で話しかける',
      '必要に応じて回答カードを空間内にピン留めし、別アプリと並べて参照する',
    ],
    tip: '周囲が騒がしい場所では、まず Compute Puck の操作で起動すると誤認識を減らせます。',
  },
  {
    id: 'compute-puck-touchpad',
    order: 3,
    category: '入力・操作',
    title: 'Compute Puckタッチパッド＆ジェスチャー',
    subtitle: '手元ポインター・スクロール・戻る操作の基本',
    description:
      'XREAL AURA の Compute Puck は処理ユニット兼トラックパッド／3DoFポインターとして機能します。ハンドトラッキングと併用し、長時間のブラウジングや精密操作を快適に行えます。',
    steps: [
      'タッチパッド上で指をスライドしてカーソル移動、タップで決定、2本指スワイプでページスクロールを試す',
      '手首の向きで空間ポインターを合わせ、クリック／ドラッグでウィンドウ移動やサイズ変更を行う',
      '戻る・ホームジェスチャー（エッジスワイプやホームボタン）でアプリ間を素早く行き来する',
    ],
    tip: 'ソファでくつろぎながら使うときは、手を上げ続けるハンド操作より Compute Puck のタッチパッド操作が圧倒的に疲れにくく快適です。',
  },
  {
    id: 'home-space-multi-app',
    order: 4,
    category: '空間マルチタスク',
    title: 'Home Space複数アプリ配置',
    subtitle: '無限キャンバスにブラウザ・動画・メモを同時展開',
    description:
      'Android XR の Home Space では、Chrome や YouTube、メモ帳などの複数ウィンドウを自分の周囲360°の好きな距離・サイズに配置して同時作業できます。',
    steps: [
      'Home Space で Chrome（本アプリ）に加えて、YouTube やメモなど別アプリを1〜2個起動する',
      '各ウィンドウ下部のハンドルをピンチ（または Puck でドラッグ）して左右や上下に空間配置する',
      '角のドラッグでウィンドウサイズを調整し、視線移動だけでマルチディスプレイ環境を体感する',
    ],
    tip: '奥行き距離を1.5〜2m程度に置くと目のピント負担が減り、長時間のマルチタスクが楽になります。',
  },
  {
    id: 'fingerprint-auth',
    order: 5,
    category: 'セキュリティ',
    title: '指紋認証',
    subtitle: 'Compute Puck での素早いロック解除とパスキー認証',
    description:
      'グラスを装着したまま空間キーボードでPINを打つ手間を省き、Compute Puck の指紋センサーに軽く触れるだけでロック解除・ログイン・決済承認を安全に完了できます。',
    steps: [
      'Android XR の「設定」＞「セキュリティ」から Compute Puck の指紋を登録する',
      'スリープ復帰時やパスワード管理・パスキー要求画面でセンサーに指を当てて認証を試す',
      '利き手・逆手の両方の指を登録しておき、どちらの手で持っても即解除できるようにする',
    ],
    tip: '人前でのロック解除でもPIN入力を見られる心配がなく、カフェや移動中でも安心して使えます。',
  },
  {
    id: 'dp-in-external',
    order: 6,
    category: '外部ディスプレイ',
    title: 'DP-in外部映像入力',
    subtitle: 'PC・ゲーム機・スマホを大画面仮想モニター化',
    description:
      'USB-C（DisplayPort Alt Mode）対応のノートPC、Steam Deck / Nintendo Switch などのゲーム機、スマートフォンを接続し、XREAL AURA を高精細な仮想大画面モニターとして活用できます。',
    steps: [
      '映像出力（DP Alt Mode）対応の USB-C ケーブルで PC やゲーム機を接続する',
      '画面サイズ・表示距離・アンカー固定（空間固定 / 追従モード）を好みに調整する',
      '電子調光をレベル4〜5に上げて、大画面のコントラストと文字の鮮明さを確認する',
    ],
    tip: '充電専用ケーブルでは映像が出ないため、USB-C 映像出力対応（10Gbps以上 / DP Alt Mode明記）ケーブルを使用してください。',
  },
  {
    id: 'bluetooth-peripherals',
    order: 7,
    category: '拡張性',
    title: 'Bluetooth周辺機器接続',
    subtitle: 'キーボード・マウス・ゲームパッド・イヤホン連携',
    description:
      'Bluetooth キーボードやマウス、ゲームコントローラー、ワイヤレスイヤホンをペアリングすれば、XREAL AURA 単体で本格的なモバイルワークステーションやゲーム環境が完成します。',
    steps: [
      'Android XR の「設定」＞「接続済みのデバイス」から「新しいデバイスとペア設定する」を開く',
      'Bluetooth キーボードまたはマウスをペアリングし、Chrome 上での文字入力やスクロールを試す',
      '本アプリの「空間オーディオ」モジュールと組み合わせて、本体スピーカーとイヤホンの定位の違いを聴き比べる',
    ],
    tip: '折りたたみキーボードを1台ペアリングしておくと、Home Space での議事録作成やコーディングが一気に実用的になります。',
  },
  {
    id: 'webxr-chrome-tips',
    order: 8,
    category: 'WebXR開発・体験',
    title: 'WebXR Chrome起動Tips',
    subtitle: 'HTTPS（Secure Context）と immersive-ar を確実に動かすコツ',
    description:
      'WebXR（immersive-ar）はセキュリティ要件により HTTPS または localhost でのみ有効になります。Chrome の権限設定と接続方法を整えると、空間6DoF・ハンド・環境認識をフル体験できます。',
    steps: [
      'ローカル開発時は `adb reverse tcp:5173 tcp:5173` で `http://localhost:5173` を開くか、Tailscale / Cloudflare Tunnel / ngrok の HTTPS URL でアクセスする',
      'WebXR 開始時に表示される「没入型ビュー（AR）の許可」ダイアログを許可する',
      'Chrome メニューから「ホーム画面に追加」を実行し、PWA（スタンドアロン表示）＋「OLED透過モード」で全画面体験する',
    ],
    tip: 'もし WebXR が利用不可と表示される場合は、アドレスバーが `https://` または `localhost` になっているかと、Chrome が最新版かを確認してください。',
    diagnostic: 'webxr',
  },
];

function loadCheckedIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const validIds = new Set(GUIDE_ITEMS.map((item) => item.id));
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && validIds.has(id)));
  } catch {
    return new Set();
  }
}

function saveCheckedIds(ids: Set<string>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Ignore storage quota or private mode restrictions
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const guideModule: ExperienceModule = {
  id: 'guide',
  title: 'オーナーズガイド',
  subtitle: '実機チェックリスト & 活用Tips',
  badge: 'GUIDE',
  summary:
    'XREAL AURA の主要8機能を実際に試しながらチェックできるインタラクティブガイド。進捗はブラウザに自動保存されます。',
  supportsWebXr: false,

  mount(container: HTMLElement, capabilities: CapabilityReport): () => void {
    let checkedIds = loadCheckedIds();
    let activeFilter: FilterMode = 'all';
    let resetArmed = false;
    let resetTimer: number | null = null;

    const clearResetArm = (): void => {
      resetArmed = false;
      if (resetTimer !== null) {
        window.clearTimeout(resetTimer);
        resetTimer = null;
      }
    };

    const renderDiagnostic = (): string => {
      const secureText = capabilities.isSecureContext ? 'HTTPS / Localhost OK' : '非セキュア接続（要HTTPS化）';
      const xrText = capabilities.immersiveArSupported
        ? 'immersive-ar 対応済み'
        : capabilities.webXrAvailable
          ? 'WebXR APIあり（AR非対応/待機）'
          : 'WebXR未検出（3Dプレビュー動作）';
      const pwaText = capabilities.isStandalonePwa ? 'PWAスタンドアロン起動中' : '通常ブラウザタブ起動中';

      return `
        <div class="guide-diag" aria-label="現在のブラウザ診断">
          <div class="guide-diag-title">現在の接続状態チェック</div>
          <div class="guide-diag-pills">
            <span class="cap-pill ${capabilities.isSecureContext ? 'is-ok' : 'is-warn'}">${escapeHtml(secureText)}</span>
            <span class="cap-pill ${capabilities.immersiveArSupported ? 'is-ok' : capabilities.webXrAvailable ? 'is-warn' : 'is-off'}">${escapeHtml(xrText)}</span>
            <span class="cap-pill ${capabilities.isStandalonePwa ? 'is-ok' : 'is-info'}">${escapeHtml(pwaText)}</span>
          </div>
        </div>
      `;
    };

    const render = (): void => {
      const total = GUIDE_ITEMS.length;
      const doneCount = checkedIds.size;
      const percent = Math.round((doneCount / total) * 100);
      const isAllDone = doneCount === total;

      const filteredItems = GUIDE_ITEMS.filter((item) => {
        const done = checkedIds.has(item.id);
        if (activeFilter === 'done') return done;
        if (activeFilter === 'todo') return !done;
        return true;
      });

      const cardsHtml =
        filteredItems.length === 0
          ? `<div class="guide-empty panel">
               <p>${activeFilter === 'todo' ? 'すべての項目を体験済みです！素晴らしい！' : 'まだ「試した！」にチェックした項目がありません。'}</p>
             </div>`
          : filteredItems
              .map((item) => {
                const isDone = checkedIds.has(item.id);
                const stepsHtml = item.steps
                  .map((step) => `<li>${escapeHtml(step)}</li>`)
                  .join('');

                return `
                  <article class="guide-card panel ${isDone ? 'is-done' : ''}" data-item-id="${item.id}">
                    <div class="guide-card-head">
                      <div class="guide-card-meta">
                        <span class="badge">${String(item.order).padStart(2, '0')}</span>
                        <span class="guide-category">${escapeHtml(item.category)}</span>
                      </div>
                      <button
                        type="button"
                        class="guide-check-btn ${isDone ? 'is-checked' : ''}"
                        data-action="toggle-check"
                        data-id="${item.id}"
                        aria-pressed="${isDone ? 'true' : 'false'}"
                      >
                        <span class="guide-check-icon" aria-hidden="true">${isDone ? '✓' : '○'}</span>
                        <span>${isDone ? '試した！' : '試したらチェック'}</span>
                      </button>
                    </div>

                    <h3 class="guide-card-title">${escapeHtml(item.title)}</h3>
                    <p class="guide-card-subtitle">${escapeHtml(item.subtitle)}</p>
                    <p class="guide-card-desc">${escapeHtml(item.description)}</p>

                    <ol class="guide-steps">
                      ${stepsHtml}
                    </ol>

                    ${item.diagnostic === 'webxr' ? renderDiagnostic() : ''}

                    <div class="guide-tip">
                      <span class="guide-tip-label">TIP</span>
                      <span>${escapeHtml(item.tip)}</span>
                    </div>
                  </article>
                `;
              })
              .join('');

      container.innerHTML = `
        <section class="guide-root" aria-label="XREAL AURA オーナーズガイド">
          <div class="guide-hero panel">
            <div class="guide-hero-top">
              <div>
                <span class="badge">XREAL AURA OWNER'S GUIDE</span>
                <h2 class="guide-hero-title">実機機能マスター・チェックリスト</h2>
                <p class="guide-hero-desc">
                  XREAL AURA の注目機能を1つずつ実機で体験し、「試した！」ボタンで記録しましょう。進捗はこのブラウザに自動保存されます。
                </p>
              </div>
              <div class="guide-score" aria-live="polite">
                <div class="guide-score-num">
                  <span class="guide-score-done">${doneCount}</span>
                  <span class="guide-score-sep">/</span>
                  <span class="guide-score-total">${total}</span>
                </div>
                <div class="guide-score-pct">${percent}% 達成</div>
              </div>
            </div>

            <div
              class="guide-progress-track"
              role="progressbar"
              aria-label="体験チェックリスト達成率"
              aria-valuemin="0"
              aria-valuemax="${total}"
              aria-valuenow="${doneCount}"
            >
              <div class="guide-progress-fill" style="width: ${percent}%"></div>
            </div>

            ${
              isAllDone
                ? `<div class="guide-complete-banner" role="status">
                     🎉 全${total}項目コンプリート！XREAL AURA の主要機能をマスターしました。
                   </div>`
                : ''
            }

            <div class="guide-toolbar">
              <div class="guide-filters" role="group" aria-label="表示フィルター">
                <button
                  type="button"
                  class="btn btn-secondary guide-filter-btn ${activeFilter === 'all' ? 'is-active' : ''}"
                  data-action="filter"
                  data-filter="all"
                >
                  すべて (${total})
                </button>
                <button
                  type="button"
                  class="btn btn-secondary guide-filter-btn ${activeFilter === 'todo' ? 'is-active' : ''}"
                  data-action="filter"
                  data-filter="todo"
                >
                  未体験 (${total - doneCount})
                </button>
                <button
                  type="button"
                  class="btn btn-secondary guide-filter-btn ${activeFilter === 'done' ? 'is-active' : ''}"
                  data-action="filter"
                  data-filter="done"
                >
                  試した！ (${doneCount})
                </button>
              </div>

              <button
                type="button"
                class="btn ${resetArmed ? 'btn-danger' : 'btn-secondary'} guide-reset-btn"
                data-action="reset"
                ${doneCount === 0 ? 'disabled' : ''}
              >
                ${resetArmed ? 'もう一度押すとリセット' : '進捗をリセット'}
              </button>
            </div>
          </div>

          <div class="guide-grid">
            ${cardsHtml}
          </div>
        </section>
      `;
    };

    const handleClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const actionEl = target.closest<HTMLElement>('[data-action]');
      if (!actionEl) return;

      const action = actionEl.dataset.action;

      if (action === 'toggle-check') {
        const id = actionEl.dataset.id;
        if (!id) return;
        clearResetArm();
        if (checkedIds.has(id)) {
          checkedIds.delete(id);
        } else {
          checkedIds.add(id);
        }
        saveCheckedIds(checkedIds);
        render();
        return;
      }

      if (action === 'filter') {
        const nextFilter = actionEl.dataset.filter as FilterMode | undefined;
        if (nextFilter === 'all' || nextFilter === 'todo' || nextFilter === 'done') {
          clearResetArm();
          activeFilter = nextFilter;
          render();
        }
        return;
      }

      if (action === 'reset') {
        if (checkedIds.size === 0) return;
        if (!resetArmed) {
          resetArmed = true;
          render();
          resetTimer = window.setTimeout(() => {
            resetArmed = false;
            resetTimer = null;
            render();
          }, 4000);
        } else {
          clearResetArm();
          checkedIds = new Set();
          saveCheckedIds(checkedIds);
          render();
        }
      }
    };

    container.addEventListener('click', handleClick);
    render();

    return () => {
      clearResetArm();
      container.removeEventListener('click', handleClick);
      container.innerHTML = '';
    };
  },
};
