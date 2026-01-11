/**
 * Concordia Shrine - Report Generator
 * 
 * セッション分析レポートを生成するユーティリティ
 */

export interface SessionData {
  sessionId: string;
  startTime: number;
  endTime: number | null;
  duration: number | null;
  securityScore: number | null;
  sceneDistribution: Record<string, number> | null;
  eventCounts: Record<string, number> | null;
  insights: string[] | null;
}

export interface ReportData {
  title: string;
  generatedAt: string;
  session: SessionData;
  analysis: {
    overallAssessment: string;
    sceneBreakdown: { scene: string; percentage: number; description: string }[];
    securityAnalysis: {
      score: number;
      level: string;
      factors: string[];
    };
    recommendations: string[];
  };
}

/**
 * シーンの説明を取得
 */
function getSceneDescription(scene: string): string {
  const descriptions: Record<string, string> = {
    '静寂': '穏やかで落ち着いた状態。参加者が思考を整理している時間です。',
    '調和': '参加者間で活発かつバランスの取れた対話が行われている理想的な状態です。',
    '一方的': '特定の参加者の発言が支配的な状態。他の参加者の発言機会が制限されている可能性があります。',
    '沈黙': '発言が途絶えている状態。緊張や不安、または発言しにくい雰囲気が存在する可能性があります。',
  };
  return descriptions[scene] || '不明な状態';
}

/**
 * セキュリティレベルを判定
 */
function getSecurityLevel(score: number): string {
  if (score >= 80) return '非常に良好';
  if (score >= 60) return '良好';
  if (score >= 40) return '注意が必要';
  return '改善が必要';
}

/**
 * セキュリティ要因を分析
 */
function analyzeSecurityFactors(
  sceneDistribution: Record<string, number> | null,
  score: number
): string[] {
  const factors: string[] = [];
  
  if (!sceneDistribution) {
    factors.push('シーンデータが不足しています');
    return factors;
  }
  
  const total = Object.values(sceneDistribution).reduce((a, b) => a + b, 0);
  if (total === 0) {
    factors.push('シーンデータが不足しています');
    return factors;
  }
  
  const harmonyRatio = (sceneDistribution['調和'] || 0) / total;
  const oneSidedRatio = (sceneDistribution['一方的'] || 0) / total;
  const silenceRatio = (sceneDistribution['沈黙'] || 0) / total;
  
  if (harmonyRatio > 0.5) {
    factors.push('対話のバランスが良好でした');
  }
  if (harmonyRatio < 0.2) {
    factors.push('調和の取れた対話の時間が少なかったです');
  }
  if (oneSidedRatio > 0.3) {
    factors.push('一方的な発言が多く見られました');
  }
  if (silenceRatio > 0.2) {
    factors.push('沈黙の時間が長く、発言しにくい雰囲気があった可能性があります');
  }
  if (score >= 80) {
    factors.push('参加者の判断の自由が守られていました');
  }
  
  return factors;
}

/**
 * 推奨事項を生成
 */
function generateRecommendations(
  sceneDistribution: Record<string, number> | null,
  score: number
): string[] {
  const recommendations: string[] = [];
  
  if (!sceneDistribution) {
    recommendations.push('より長いセッションを行い、対話パターンを分析することをお勧めします');
    return recommendations;
  }
  
  const total = Object.values(sceneDistribution).reduce((a, b) => a + b, 0);
  if (total === 0) return recommendations;
  
  const harmonyRatio = (sceneDistribution['調和'] || 0) / total;
  const oneSidedRatio = (sceneDistribution['一方的'] || 0) / total;
  const silenceRatio = (sceneDistribution['沈黙'] || 0) / total;
  
  if (oneSidedRatio > 0.3) {
    recommendations.push('発言の順番を決めるなど、全員が発言できる仕組みを導入してみてください');
    recommendations.push('「〇〇さんはどう思いますか？」と名指しで意見を求めることで、発言機会を均等化できます');
  }
  
  if (silenceRatio > 0.2) {
    recommendations.push('アイスブレイクや雑談の時間を設け、発言しやすい雰囲気を作りましょう');
    recommendations.push('「正解はない」「どんな意見も歓迎」というメッセージを明確に伝えましょう');
  }
  
  if (harmonyRatio < 0.3) {
    recommendations.push('対話の目的やゴールを明確にし、全員で共有することで、建設的な議論を促進できます');
  }
  
  if (score < 60) {
    recommendations.push('介入機能を有効にし、場の空気の変化に早めに気づけるようにしましょう');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('現在の対話スタイルを維持し、引き続き参加者全員の発言機会を大切にしてください');
  }
  
  return recommendations;
}

/**
 * 全体評価を生成
 */
function generateOverallAssessment(
  sceneDistribution: Record<string, number> | null,
  score: number,
  duration: number | null
): string {
  if (!sceneDistribution || !duration) {
    return 'セッションデータが不十分なため、詳細な評価ができません。';
  }
  
  const total = Object.values(sceneDistribution).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return 'シーンデータが記録されていないため、評価ができません。';
  }
  
  const durationMinutes = Math.round(duration / 60000);
  const harmonyRatio = (sceneDistribution['調和'] || 0) / total;
  const level = getSecurityLevel(score);
  
  if (score >= 80) {
    return `${durationMinutes}分間のセッションにおいて、対話の質は「${level}」でした。参加者間のバランスが取れており、全員が発言しやすい環境が維持されていました。調和の取れた対話が全体の${Math.round(harmonyRatio * 100)}%を占めており、ヒューマンセキュリティの観点から理想的な状態でした。`;
  } else if (score >= 60) {
    return `${durationMinutes}分間のセッションにおいて、対話の質は「${level}」でした。概ね良好な対話が行われましたが、一部で発言の偏りや沈黙が見られました。調和の取れた対話は全体の${Math.round(harmonyRatio * 100)}%でした。`;
  } else {
    return `${durationMinutes}分間のセッションにおいて、対話の質は「${level}」でした。発言の偏りや沈黙が多く見られ、参加者の中に発言しにくさを感じている方がいた可能性があります。次回は介入機能を活用し、早めの気づきを促すことをお勧めします。`;
  }
}

/**
 * レポートデータを生成する
 * 
 * セッションデータから分析レポートのデータを生成する。
 * 全体評価、シーン分析、セキュリティ分析、推奨事項などを含む。
 * 
 * @param session - セッションデータ（ID、開始/終了時刻、セキュリティスコア、シーン分布など）
 * @returns レポートデータ（タイトル、生成日時、セッション情報、分析結果）
 */
export function generateReportData(session: SessionData): ReportData {
  const sceneBreakdown: ReportData['analysis']['sceneBreakdown'] = [];
  
  if (session.sceneDistribution) {
    const total = Object.values(session.sceneDistribution).reduce((a, b) => a + b, 0);
    
    for (const [scene, count] of Object.entries(session.sceneDistribution)) {
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      sceneBreakdown.push({
        scene,
        percentage,
        description: getSceneDescription(scene),
      });
    }
    
    // パーセンテージの高い順にソート
    sceneBreakdown.sort((a, b) => b.percentage - a.percentage);
  }
  
  const score = session.securityScore ?? 0;
  
  return {
    title: 'Concordia Shrine セッションレポート',
    generatedAt: new Date().toLocaleString('ja-JP'),
    session,
    analysis: {
      overallAssessment: generateOverallAssessment(
        session.sceneDistribution,
        score,
        session.duration
      ),
      sceneBreakdown,
      securityAnalysis: {
        score,
        level: getSecurityLevel(score),
        factors: analyzeSecurityFactors(session.sceneDistribution, score),
      },
      recommendations: generateRecommendations(session.sceneDistribution, score),
    },
  };
}

/**
 * レポートをMarkdown形式で出力する
 * 
 * レポートデータをMarkdown形式の文字列に変換する。
 * セッション概要、全体評価、シーン分析、セキュリティ分析、推奨事項などを含む。
 * 
 * @param data - レポートデータ
 * @returns Markdown形式のレポート文字列
 */
export function generateMarkdownReport(data: ReportData): string {
  const lines: string[] = [];
  
  lines.push(`# ${data.title}`);
  lines.push('');
  lines.push(`**生成日時:** ${data.generatedAt}`);
  lines.push('');
  
  // セッション概要
  lines.push('## セッション概要');
  lines.push('');
  lines.push(`- **セッションID:** ${data.session.sessionId}`);
  lines.push(`- **開始時刻:** ${new Date(data.session.startTime).toLocaleString('ja-JP')}`);
  if (data.session.endTime) {
    lines.push(`- **終了時刻:** ${new Date(data.session.endTime).toLocaleString('ja-JP')}`);
  }
  if (data.session.duration) {
    const minutes = Math.floor(data.session.duration / 60000);
    const seconds = Math.floor((data.session.duration % 60000) / 1000);
    lines.push(`- **セッション時間:** ${minutes}分${seconds}秒`);
  }
  lines.push(`- **セキュリティスコア:** ${data.analysis.securityAnalysis.score}/100 (${data.analysis.securityAnalysis.level})`);
  lines.push('');
  
  // 全体評価
  lines.push('## 全体評価');
  lines.push('');
  lines.push(data.analysis.overallAssessment);
  lines.push('');
  
  // シーン分析
  lines.push('## シーン分析');
  lines.push('');
  lines.push('| シーン | 割合 | 説明 |');
  lines.push('|--------|------|------|');
  for (const scene of data.analysis.sceneBreakdown) {
    lines.push(`| ${scene.scene} | ${scene.percentage}% | ${scene.description} |`);
  }
  lines.push('');
  
  // セキュリティ分析
  lines.push('## ヒューマンセキュリティ分析');
  lines.push('');
  lines.push('### 評価要因');
  lines.push('');
  for (const factor of data.analysis.securityAnalysis.factors) {
    lines.push(`- ${factor}`);
  }
  lines.push('');
  
  // 推奨事項
  lines.push('## 推奨事項');
  lines.push('');
  for (const rec of data.analysis.recommendations) {
    lines.push(`- ${rec}`);
  }
  lines.push('');
  
  // インサイト
  if (data.session.insights && data.session.insights.length > 0) {
    lines.push('## セッション中のインサイト');
    lines.push('');
    for (const insight of data.session.insights) {
      lines.push(`- ${insight}`);
    }
    lines.push('');
  }
  
  // フッター
  lines.push('---');
  lines.push('');
  lines.push('*このレポートは Concordia Shrine によって自動生成されました。*');
  lines.push('');
  lines.push('> 「ヒューマンセキュリティなくしてサイバーセキュリティは実現しない」');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * レポートをHTML形式で生成する
 * 
 * レポートデータをHTML形式の文字列に変換する。
 * Markdown形式のレポートを簡易的にHTMLに変換し、スタイルを適用する。
 * 
 * @param data - レポートデータ
 * @returns HTML形式のレポート文字列（完全なHTMLドキュメント）
 */
export function generateHtmlReport(data: ReportData): string {
  const markdown = generateMarkdownReport(data);
  
  // 簡易的なMarkdown→HTML変換
  let html = markdown
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/---/g, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  
  // テーブルの変換
  html = html.replace(
    /\| (.+?) \| (.+?) \| (.+?) \|<br>\|[-|]+\|<br>((?:\| .+? \| .+? \| .+? \|<br>)+)/g,
    (_, h1, h2, h3, rows) => {
      const headerRow = `<tr><th>${h1}</th><th>${h2}</th><th>${h3}</th></tr>`;
      const dataRows = rows
        .split('<br>')
        .filter((r: string) => r.trim())
        .map((r: string) => {
          const cells = r.split('|').filter((c: string) => c.trim());
          return `<tr><td>${cells.join('</td><td>')}</td></tr>`;
        })
        .join('');
      return `<table><thead>${headerRow}</thead><tbody>${dataRows}</tbody></table>`;
    }
  );
  
  // リストのラップ
  html = html.replace(/(<li>.+?<\/li>)+/g, '<ul>$&</ul>');
  
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title}</title>
  <style>
    :root {
      --bg: #0a0a0a;
      --fg: #fafafa;
      --muted: #a1a1aa;
      --border: #27272a;
      --jade: #4ade80;
      --gold: #fbbf24;
    }
    body {
      font-family: 'Noto Sans JP', sans-serif;
      background: var(--bg);
      color: var(--fg);
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.7;
    }
    h1 { color: var(--jade); border-bottom: 2px solid var(--jade); padding-bottom: 0.5rem; }
    h2 { color: var(--gold); margin-top: 2rem; }
    h3 { color: var(--muted); }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { border: 1px solid var(--border); padding: 0.75rem; text-align: left; }
    th { background: var(--border); }
    ul { padding-left: 1.5rem; }
    li { margin: 0.5rem 0; }
    blockquote { 
      border-left: 3px solid var(--jade); 
      padding-left: 1rem; 
      color: var(--muted);
      font-style: italic;
    }
    hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
    strong { color: var(--jade); }
    @media print {
      body { background: white; color: black; }
      h1, h2, strong { color: #166534; }
      th { background: #f3f4f6; }
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>
  `.trim();
}

/**
 * レポートをダウンロードする
 * 
 * レポートデータを指定された形式（MarkdownまたはHTML）でダウンロードする。
 * ブラウザのダウンロード機能を使用してファイルを保存する。
 * 
 * @param data - レポートデータ
 * @param format - ダウンロード形式（'markdown'または'html'）
 */
export function downloadReport(data: ReportData, format: 'markdown' | 'html'): void {
  let content: string;
  let filename: string;
  let mimeType: string;
  
  const timestamp = new Date().toISOString().slice(0, 10);
  
  if (format === 'markdown') {
    content = generateMarkdownReport(data);
    filename = `concordia-report-${timestamp}.md`;
    mimeType = 'text/markdown';
  } else {
    content = generateHtmlReport(data);
    filename = `concordia-report-${timestamp}.html`;
    mimeType = 'text/html';
  }
  
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
