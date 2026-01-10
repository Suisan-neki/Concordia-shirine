/**
 * Concordia Shrine - Transcript Display Component
 * 
 * リアルタイム文字起こしの表示
 * - 川の流れのように下部で静かに流れる
 * - 確定したテキストと暫定テキストの区別
 */

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TranscriptItem {
  id: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

interface TranscriptDisplayProps {
  transcripts: TranscriptItem[];
  interimText: string;
  className?: string;
}

export function TranscriptDisplay({ transcripts, interimText, className = '' }: TranscriptDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 新しいテキストが追加されたら自動スクロール
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [transcripts, interimText]);
  
  // 最新の5件のみ表示
  const recentTranscripts = transcripts.slice(-5);
  
  return (
    <div className={`fixed bottom-32 left-0 right-0 z-10 pointer-events-none ${className}`}>
      <div className="max-w-4xl mx-auto px-4">
        <div
          ref={containerRef}
          className="overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-none"
          style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}
        >
          <div className="inline-flex items-center gap-4 py-2">
            <AnimatePresence mode="popLayout">
              {recentTranscripts.map((item) => (
                <motion.span
                  key={item.id}
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  className={`inline-block px-3 py-1.5 rounded-lg text-sm ${
                    item.isFinal
                      ? 'bg-card/60 text-foreground/80'
                      : 'bg-card/40 text-foreground/60'
                  }`}
                >
                  {item.text}
                </motion.span>
              ))}
            </AnimatePresence>
            
            {/* 暫定テキスト */}
            {interimText && (
              <motion.span
                key="interim"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="inline-block px-3 py-1.5 rounded-lg text-sm bg-shrine-jade/20 text-shrine-jade/80 border border-shrine-jade/30"
              >
                {interimText}
              </motion.span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TranscriptDisplay;
