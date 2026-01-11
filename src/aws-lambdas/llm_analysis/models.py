from pydantic import BaseModel, Field, model_validator
from typing import Literal

class Scoring(BaseModel):
    harmony_score: int = Field(..., description="調和度スコア (0-10): 参加者間の協力体制や雰囲気")
    engagement_score: int = Field(..., description="関与度スコア (0-10): 参加者の積極的な発言や姿勢")
    clarity_score: int = Field(..., description="明確性スコア (0-10): 議論の目的や結論の明確さ")
    
    # Computed field handled by validator, or explicit field validated
    total_score: int = Field(0, description="総合会議品質スコア (0-100) - 自動計算されます")
    
    # Generic segmentation
    segment: Literal["Strategic", "Operations", "Team Building", "Casual", "Conflict"] = Field(..., description="会議のタイプ分類")

    @model_validator(mode='after')
    def calculate_total_score(self) -> 'Scoring':
        """各スコアから総合スコアを自動計算し、整合性を保つ"""
        # 重み付け計算 (例: 調和40%, 関与30%, 明確性30%)
        calculated = (
            self.harmony_score * 4 + 
            self.engagement_score * 3 + 
            self.clarity_score * 3
        )
        # 上書き (または初回の設定)
        self.total_score = min(100, max(0, calculated))
        return self

class ConcordiaAnalysisData(BaseModel):
    summary: str = Field(..., description="会議の概要 (3文以内)")
    topics: list[str] = Field(..., description="主な議題 (箇条書き)")
    decisions: list[str] = Field(..., description="決定事項 (箇条書き)")
    action_items: list[str] = Field(..., description="アクションアイテム（担当者・期限）")
    issues: list[str] = Field(..., description="残された課題・懸念点")
    key_quotes: list[str] = Field(..., description="印象的な発言や重要なキーワード")
    scoring: Scoring = Field(..., description="会議のスコアリングと分類")
