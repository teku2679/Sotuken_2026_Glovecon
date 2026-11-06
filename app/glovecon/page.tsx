// ==========================================
// 設定項目：Microsoft Forms の URL や展示情報を変更してください
// ==========================================
const HOMEPAGE_URL = "./";
const E_URL = "https://5ekosenfes2026.vercel.app";
const EXHIBITION_TITLE = "グローブコントローラ 解説";
const CATCH_PHRASE = "グローブ型コントローラの開発過程や仕組みを解説します！";
const LOCATION_INFO = "専門棟1 2階 コミュニケーション談話室1";
const CLASS_NAME = "安藤研究室 卒業研究展示";
const E_LOCATION_INFO = "体育館裏 武道館";
const E_CLASS_NAME = "5年 エレクトロニクスコース";

export default function ExhibitionPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16">
      {/* 1. ヒーローヘッダー */}
      <header className="bg-linear-to-r from-teal-600 to-emerald-600 text-white py-12 px-6 text-center shadow-lg">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full mb-3 tracking-wider">
            {CLASS_NAME} 展示特設サイト
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">
            {EXHIBITION_TITLE}
          </h1>
          <p className="text-base sm:text-lg text-emerald-100 font-medium">
            {CATCH_PHRASE}
          </p>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-3xl mx-auto px-6 mt-8 space-y-10">

        {/* 2. 展示の見どころ*/}
        <section className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-6 text-center border-b pb-3">
            🎮 コントローラの3要素
          </h2>
          
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="bg-emerald-50/70 p-5 rounded-xl border border-emerald-100 text-center">
              <h3 className="font-bold text-slate-900 text-base mb-1">🖥️ マイコン 🖥️</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                センサーの値の読み取りとデータの送信を行っています。
              </p>
              <img src="/img/ESP32.jpg" alt="ESP32" className="mx-auto my-3" />
              <p className="text-xs text-slate-600 leading-relaxed">
                ESP32というマイコンを使用しています。
              </p>
            </div>

            <div className="bg-emerald-50/70 p-5 rounded-xl border border-emerald-100 text-center">
              <h3 className="font-bold text-slate-900 text-base mb-1">🫲 慣性センサー 🫱</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                手の移動と回転をトラッキングしています。
              </p>
              <img src="/img/LSM6DS3.jpg" alt="IMU-LSM6DS3" className="mx-auto my-3" />
              <p className="text-xs text-slate-600 leading-relaxed">
                LSM6DS3という慣性センサーを使用しています。
              </p>
            </div>

            <div className="bg-emerald-50/70 p-5 rounded-xl border border-emerald-100 text-center">
              <h3 className="font-bold text-slate-900 text-base mb-1">👉 圧力センサ 👈</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                指の曲げを圧力センサで検知しています。
              </p>
              <img src="/img/aturyoku.jpg" alt="圧力センサ" className="mx-auto my-3" />
              <p className="text-xs text-slate-600 leading-relaxed">
                片手さえあれば子どもから大人まで誰でも楽しんでいただけます！
              </p>
            </div>

          </div>
        </section>

        <section className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-6 text-center border-b pb-3">
            🎮 コントローラの外装
          </h2>
          <img src="/img/glovecon.jpg" alt="グローブコントローラ" className="mx-auto my-3" />
          
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="bg-emerald-50/70 p-5 rounded-xl border border-emerald-100 text-center">
              <h3 className="font-bold text-slate-900 text-base mb-1">回路基板</h3>
              <img src="/img/kiban.jpg" alt="回路基板" className="mx-auto my-3" />
            </div>

          </div>
        </section>

        {/* 3. Microsoft Forms アンケート誘導セクション */}
        <section className="bg-linear-to-br from-amber-50 to-orange-50 p-6 sm:p-8 rounded-2xl border-2 border-amber-300 shadow-md text-center">

          {/* Microsoft Forms ボタン */}
          <div className="space-y-4">
            <a
              href={HOMEPAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-lg py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 gap-2"
            >
              
              <span>ホームページへ戻る</span>

            </a>
          </div>

        </section>

        {/* 4. ブース情報 */}
        <section className="bg-white p-6 rounded-2xl border border-slate-200 text-center shadow-sm">
          <h3 className="font-bold text-slate-900 text-base mb-2">📍 関連ブース</h3>
          <div className="space-y-4">
            <a
              href={E_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-lg py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 gap-2"
            >
              
              <span>📋<br />5年<br />エレクトロニクスコース<br />ボタンラッシュ</span>
            </a>
          </div>
          <p className="text-sm font-semibold text-teal-700 mt-4 mb-1">{E_CLASS_NAME}</p>
          <p className="text-xs text-slate-600">展示場所：{E_LOCATION_INFO}</p>
        </section>
        <section className="bg-white p-6 rounded-2xl border border-slate-200 text-center shadow-sm">
          <h3 className="font-bold text-slate-900 text-base mb-2">📍 ブース案内</h3>
          <p className="text-sm font-semibold text-teal-700 mb-1">{CLASS_NAME}</p>
          <p className="text-xs text-slate-600">展示場所：{LOCATION_INFO}</p>
        </section>

      </main>

      {/* フッター */}
      <footer className="text-center text-xs text-slate-400 mt-12">
        高専祭 展示特設ページ &copy; 2026
      </footer>
    </div>
  );
}
