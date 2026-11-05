// ==========================================
// 設定項目：Microsoft Forms の URL や展示情報を変更してください
// ==========================================
const MS_FORMS_URL = "https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=6Zxr3Lqm0069Z5-eOshc8YnImyZOG7tAjKPa3j2V1-FUOFFDMTNVQVVKSDVOWFZQMFg0TEdMM0xLQS4u";
const EXHIBITION_TITLE = "高専祭 グローブコントローラ 展示説明";
const CATCH_PHRASE = "グローブ型コントローラを装着して、ロボット操縦を体験しよう！";
const LOCATION_INFO = "専門棟1 2階 コミュニケーション談話室1";
const CLASS_NAME = "安藤研究室 卒業研究展示";

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
            ✨ 展示のみどころポイント
          </h2>
          
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="bg-emerald-50/70 p-5 rounded-xl border border-emerald-100 text-center">
              <h3 className="font-bold text-slate-900 text-base mb-1">🎮 直感的に遊べる</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                装着型コントローラです！
              </p>
              <img src="./img/glove_controller.jpg" alt="グローブコントローラ" />
              <p className="text-xs text-slate-600 leading-relaxed">
                片手さえあれば子どもから大人まで誰でも楽しんでいただけます！
              </p>
            </div>

            <div className="bg-emerald-50/70 p-5 rounded-xl border border-emerald-100 text-center">
              <h3 className="font-bold text-slate-900 text-base mb-1">🎯 2つのミッション</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                ロボットを操縦して、2つのミッションをクリアしよう！<br />ミッションの難易度は、初心者でも楽しめるように調整しています。
              </p>
              <div className="mt-3 space-y-2">
                <h4 className="font-bold text-slate-900 text-lg mt-2">🏁 ミッション1</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  障害物を避けつつコースを周回するミッションです。<br />素早い操作と判断力が求められます。
                </p>
                <h4 className="font-bold text-slate-900 text-lg mt-2">🎯 ミッション2</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  指定されたルートを進み、ゴールに停車させるミッションです。<br />操作の丁寧さが試されます。
                </p>
              </div>
              
            </div>

          </div>
        </section>

        {/* 3. Microsoft Forms アンケート誘導セクション */}
        <section className="bg-linear-to-br from-amber-50 to-orange-50 p-6 sm:p-8 rounded-2xl border-2 border-amber-300 shadow-md text-center">
          <div className="inline-block bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full mb-3 shadow-sm">
            所要時間：約5分 ⏱️
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2">
            お越しいただいた皆さまへ、アンケートのお願い
          </h2>
          <p className="text-sm text-slate-700 mb-6 max-w-lg mx-auto leading-relaxed">
            ご来場ありがとうございました！本研究では皆さまからのご感想・フィードバックが重要なデータとなります。ぜひアンケートへのご協力をお願いいたします。
          </p>

          {/* Microsoft Forms ボタン */}
          <div className="space-y-4">
            <a
              href={MS_FORMS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-lg py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 gap-2"
            >
              
              <span>📋<br />アンケートはこちらから<br />(Microsoft Forms)</span>
            </a>
          </div>

          <p className="text-xs text-slate-500 mt-4">
            ※ 匿名でご回答いただけます。お気軽にご意見をお寄せください。
          </p>

          {/* 埋め込み表示（任意で表示したい場合はコメント解除して使用） */}
          {/*
          <div className="mt-8 border-t border-amber-200 pt-6">
            <p className="text-xs text-slate-600 mb-3 font-semibold">▼ このページ内でそのまま回答する</p>
            <div className="w-full h-[500px] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-inner">
              <iframe
                src={MS_FORMS_URL}
                className="w-full h-full border-none"
                title="Microsoft Forms Exhibition Survey"
              />
            </div>
          </div>
          */}
        </section>

        {/* 4. ブース情報 */}
        <section className="bg-white p-6 rounded-2xl border border-slate-200 text-center shadow-sm">
          <h3 className="font-bold text-slate-900 text-base mb-2">📍 関連ブース</h3>
          <div className="space-y-4">
            <a
              href={MS_FORMS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-lg py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 gap-2"
            >
              
              <span>📋<br />5年エレクトロニクスコース<br />ボタンラッシュ</span>
            </a>
          </div>
          <p className="text-sm font-semibold text-teal-700 mt-4 mb-1">{CLASS_NAME}</p>
          <p className="text-xs text-slate-600">展示場所：{LOCATION_INFO}</p>
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
