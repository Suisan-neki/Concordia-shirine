/**
 * About Page - Concordia Shrine
 * 
 * プロジェクトの哲学と技術を物語として説明するページ
 * 「気づかないうちに守られている」を体現
 */

import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function About() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ヘッダー */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <span className="text-lg font-serif-jp cursor-pointer hover:text-primary transition-colors">
              Concordia Shrine
            </span>
          </Link>
          <Link href="/">
            <Button variant="outline" size="sm">
              祠に戻る
            </Button>
          </Link>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container mx-auto px-4 pt-24 pb-16 max-w-3xl">
        {/* タイトル */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-3xl md:text-4xl font-serif-jp mb-4">
            見えない結界の物語
          </h1>
          <p className="text-muted-foreground">
            「ヒューマンセキュリティなくしてサイバーセキュリティは実現しない」
          </p>
        </motion.div>

        {/* 物語 */}
        <motion.article
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="prose prose-invert prose-sm md:prose-base mx-auto"
        >
          {/* 序章 */}
          <section className="mb-12">
            <h2 className="text-xl font-serif-jp text-foreground border-b border-border/50 pb-2 mb-4">
              序章：聖域の誕生
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              あなたがこの祠を訪れた瞬間、見えない結界が展開されました。
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              それは、あなたが気づくことなく、静かに、しかし確実に動き始めています。
              あなたの言葉を守り、あなたの判断の自由を守り、
              あなたが安心して対話できる空間を創り出すために。
            </p>
            <p className="text-muted-foreground leading-relaxed">
              これは、技術が人を守る物語です。
            </p>
          </section>

          {/* 第一章 */}
          <section className="mb-12">
            <h2 className="text-xl font-serif-jp text-foreground border-b border-border/50 pb-2 mb-4">
              第一章：見えない守護者たち
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              あなたがこのページを読んでいる今も、いくつもの守護者が働いています。
            </p>
            
            <div className="bg-muted/20 rounded-lg p-4 my-6 border border-border/30">
              <h3 className="text-sm font-medium text-foreground mb-3">🔐 暗号化の守護者</h3>
              <p className="text-xs text-muted-foreground">
                あなたの会話データは、AES-256-GCMという軍事レベルの暗号化で保護されています。
                たとえ誰かがデータを盗み見ようとしても、そこにあるのは意味のない文字列だけです。
              </p>
            </div>

            <div className="bg-muted/20 rounded-lg p-4 my-6 border border-border/30">
              <h3 className="text-sm font-medium text-foreground mb-3">⚡ 門番の守護者</h3>
              <p className="text-xs text-muted-foreground">
                異常なアクセスパターンを検知すると、自動的にブロックします。
                あなたの聖域に、招かれざる客は入れません。
              </p>
            </div>

            <div className="bg-muted/20 rounded-lg p-4 my-6 border border-border/30">
              <h3 className="text-sm font-medium text-foreground mb-3">🧹 浄化の守護者</h3>
              <p className="text-xs text-muted-foreground">
                悪意のあるコードの注入を防ぎます。
                あなたのデータは、常に清浄な状態に保たれています。
              </p>
            </div>

            <div className="bg-muted/20 rounded-lg p-4 my-6 border border-border/30">
              <h3 className="text-sm font-medium text-foreground mb-3">📋 記録の守護者</h3>
              <p className="text-xs text-muted-foreground">
                すべてのセキュリティイベントは静かに記録されています。
                何かあったとき、あなたを守った証拠がそこにあります。
              </p>
            </div>

            <p className="text-muted-foreground leading-relaxed">
              これらの守護者は、あなたが意識することなく、
              バックグラウンドで静かに働き続けています。
            </p>
          </section>

          {/* 第二章 */}
          <section className="mb-12">
            <h2 className="text-xl font-serif-jp text-foreground border-b border-border/50 pb-2 mb-4">
              第二章：心の守護者
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              しかし、技術だけでは守れないものがあります。
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              それは、あなたの「判断の自由」です。
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              会議で、誰かの意見に押されて本当は違うと思っていることに賛成してしまったことはありませんか？
              沈黙の圧力に負けて、言いたいことを飲み込んでしまったことは？
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              これらは、サイバー攻撃ではありません。
              しかし、あなたの判断の自由を奪う「攻撃」です。
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Concordia Shrineは、この「見えない攻撃」を検知します。
            </p>

            <div className="bg-shrine-jade/10 rounded-lg p-4 my-6 border border-shrine-jade/30">
              <h3 className="text-sm font-medium text-shrine-jade mb-3">💚 同意保護の仕組み</h3>
              <p className="text-xs text-muted-foreground mb-2">
                波の形が変わったとき、それは「空気」が変わったサインです。
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• 一方的な発言が続くと、波は赤く、荒々しくなります</li>
                <li>• 沈黙が続くと、波は暗く、重くなります</li>
                <li>• 調和が取れていると、波は穏やかに、美しく流れます</li>
              </ul>
            </div>

            <p className="text-muted-foreground leading-relaxed">
              この「気づき」が、あなたの判断の自由を守る第一歩です。
            </p>
          </section>

          {/* 第三章 */}
          <section className="mb-12">
            <h2 className="text-xl font-serif-jp text-foreground border-b border-border/50 pb-2 mb-4">
              第三章：二つの守護の融合
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              サイバーセキュリティとヒューマンセキュリティ。
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              この二つは、別々のものではありません。
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              技術的な安全が、心理的な安心を生みます。
              「自分のデータは守られている」という安心感が、
              自由な発言を可能にします。
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              そして、心理的な安全が、技術的な安全を強化します。
              安心して報告できる環境があれば、
              セキュリティインシデントは早期に発見されます。
            </p>

            <div className="bg-primary/10 rounded-lg p-6 my-6 border border-primary/30 text-center">
              <p className="text-sm text-foreground font-medium">
                「ヒューマンセキュリティなくしてサイバーセキュリティは実現しない」
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                この言葉の意味が、今、あなたの中で響いているでしょうか。
              </p>
            </div>
          </section>

          {/* 終章 */}
          <section className="mb-12">
            <h2 className="text-xl font-serif-jp text-foreground border-b border-border/50 pb-2 mb-4">
              終章：あなたの聖域
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              この祠は、あなたのための聖域です。
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              ここでは、技術があなたを守り、
              あなたは自由に考え、自由に話すことができます。
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              そして、もしあなたが「詳細」ボタンを押せば、
              今まで気づかなかった守護者たちの働きを見ることができます。
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              彼らは、あなたが気づかないうちに、
              何度もあなたを守っていたのです。
            </p>
            <p className="text-muted-foreground leading-relaxed">
              これが、Concordia Shrine の物語です。
            </p>
          </section>

          {/* 技術仕様 */}
          <section className="mt-16 pt-8 border-t border-border/50">
            <h2 className="text-lg font-serif-jp text-foreground mb-4">
              技術仕様
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-muted/20 rounded-lg p-4">
                <h3 className="font-medium text-foreground mb-2">暗号化</h3>
                <p className="text-muted-foreground">AES-256-GCM</p>
              </div>
              <div className="bg-muted/20 rounded-lg p-4">
                <h3 className="font-medium text-foreground mb-2">認証</h3>
                <p className="text-muted-foreground">OAuth 2.0 + JWT</p>
              </div>
              <div className="bg-muted/20 rounded-lg p-4">
                <h3 className="font-medium text-foreground mb-2">通信</h3>
                <p className="text-muted-foreground">TLS 1.3</p>
              </div>
              <div className="bg-muted/20 rounded-lg p-4">
                <h3 className="font-medium text-foreground mb-2">波生成</h3>
                <p className="text-muted-foreground">Perlin Noise Algorithm</p>
              </div>
            </div>
          </section>
        </motion.article>

        {/* CTAボタン */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-16"
        >
          <Link href="/">
            <Button size="lg" className="font-serif-jp">
              祠に入る
            </Button>
          </Link>
        </motion.div>
      </main>

      {/* フッター */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">
            Concordia Shrine v2 — Human Decision Security
          </p>
        </div>
      </footer>
    </div>
  );
}
