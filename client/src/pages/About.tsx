/**
 * About Page - Concordia Shrine
 * 
 * プロジェクトの哲学と技術を物語として説明するページ
 * 「気づかないうちに守られている」を体現
 */

import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

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
      <main className="container mx-auto px-4 pt-24 pb-16 max-w-4xl">
        {/* タイトル */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl md:text-4xl font-serif-jp mb-4">
            見えない結界の物語
          </h1>
          <p className="text-muted-foreground">
            Human Decision Security Visualization System
          </p>
        </motion.div>

        <Tabs defaultValue="philosophy" className="w-full">
          <div className="flex justify-center mb-12">
            <TabsList className="grid w-full max-w-[400px] grid-cols-2">
              <TabsTrigger value="philosophy">哲学 (Philosophy)</TabsTrigger>
              <TabsTrigger value="technology">技術 (Technology)</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="philosophy">
            <motion.article
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="prose prose-invert prose-sm md:prose-base mx-auto max-w-3xl"
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
                  沈黙が続いて、言いたいことを飲み込んでしまったことは？
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
                    <li>• 沈黙が続くと、波は柔らかく整い、余白を示します</li>
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
                <p className="text-muted-foreground leading-relaxed">
                  これが、Concordia Shrine の物語です。
                </p>
              </section>

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
            </motion.article>
          </TabsContent>

          <TabsContent value="technology">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif-jp text-lg">システムアーキテクチャ</CardTitle>
                    <CardDescription>Serverless & Event-Driven</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-muted/30 p-4 rounded-md text-xs font-mono">
                      [Client] React/Vite/Tailwind
                      ↓(CloudFront)
                      [Edge] Security Headers(WAF)
                      ↓(API Gateway + tRPC)
                      [Backend] AWS Lambda(Node.js/Python)
                      ↓
                      [AI] OpenAI(Realtime/Audio/GPT-5-mini)
                    </div>
                    <p className="text-sm text-muted-foreground">
                      完全なサーバーレス構成により、高い可用性とスケーラビリティを実現。
                      インフラ管理コストを最小限に抑えつつ、エンタープライズグレードのセキュリティを提供します。
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif-jp text-lg">AI & Analysis</CardTitle>
                    <CardDescription>Multimedia Processing</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Badge variant="outline" className="text-shrine-jade border-shrine-jade">Perlin Noise</Badge>
                      <Badge variant="outline" className="text-shrine-vermilion border-shrine-vermilion ml-2">OpenAI Whisper</Badge>
                      <Badge variant="outline" className="text-primary border-primary ml-2">GPT-5-mini</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      リアルタイムの音声波形分析(Web Audio API)と、LLMによる文脈分析を融合。
                      「空気」という抽象的な概念を、数学的なモデルを通じて可視化しています。
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-serif-jp border-l-4 border-shrine-jade pl-4">Tech Stack 詳細</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground text-sm">Frontend</h4>
                    <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                      <li>React 19</li>
                      <li>TypeScript 5.x</li>
                      <li>Vite 6.x</li>
                      <li>Tailwind CSS 4</li>
                      <li>Framer Motion</li>
                      <li>Radix UI</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground text-sm">Backend</h4>
                    <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                      <li>tRPC (Type-safe API)</li>
                      <li>AWS Lambda (Adapter)</li>
                      <li>Node.js / Python Runtime</li>
                      <li>OpenAI API</li>
                      <li>Drizzle ORM</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground text-sm">Infrastructure (IaC)</h4>
                    <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                      <li>AWS CDK</li>
                      <li>Cognito (Auth)</li>
                      <li>CloudFront (CDN)</li>
                      <li>S3 (Storage/Hosting)</li>
                      <li>API Gateway</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-serif-jp border-l-4 border-shrine-vermilion pl-4">Security Implementation</h3>
                <Card>
                  <CardContent className="pt-6">
                    <ul className="space-y-4 text-sm text-muted-foreground">
                      <li className="flex gap-3">
                        <span className="text-foreground min-w-[120px] font-medium">Domain Segregation</span>
                        <span>フロントエンドとバックエンドのドメイン分離によるXXSリスクの低減</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="text-foreground min-w-[120px] font-medium">Least Privilege</span>
                        <span>Lambdaには必要最小限のIAM権限のみを付与</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="text-foreground min-w-[120px] font-medium">Type Safety</span>
                        <span>tRPCによるエンドツーエンドの型安全性で、不正なデータ構造を排除</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="text-foreground min-w-[120px] font-medium">Constructor Safety</span>
                        <span>ドメインモデル(DDD)において、不正な状態のオブジェクト生成をコンパイルレベルで防止</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <div className="text-center mt-12 bg-muted/10 p-8 rounded-lg">
                <p className="font-serif-jp text-lg mb-4">Developers</p>
                <p className="text-muted-foreground text-sm">
                  Designed & Developed by the Concordia Shrine Team
                  <br />
                  Powered by Advanced Agentic Coding
                </p>
                <div className="mt-6">
                  <Link href="https://github.com/Suisan-neki/Concordia-shirine">
                    <Button variant="outline" className="gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.66-3.795-1.455-3.795-1.455-.54-1.38-1.335-1.755-1.335-1.755-1.095-.75.09-.735.09-.735 1.2.09 1.83 1.245 1.83 1.245 1.08 1.86 2.805 1.32 3.495 1.005.105-.78.42-1.32.765-1.62-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405 1.02 0 2.04.135 3 .405 2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.285 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
                      Source Code
                    </Button>
                  </Link>
                </div>
              </div>

            </motion.div>
          </TabsContent>
        </Tabs>

      </main>

      {/* フッター */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">
            Concordia Shrine — Human Decision Security
          </p>
        </div>
      </footer>
    </div>
  );
}
