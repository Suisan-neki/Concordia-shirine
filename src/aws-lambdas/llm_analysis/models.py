from pydantic import BaseModel, Field
from typing import Literal

class Scoring(BaseModel):
    electric_bill_score: int = Field(..., description="電気代関心度スコア (0-10)")
    engagement_score: int = Field(..., description="エンゲージメントスコア (0-10)")
    crowdfunding_score: int = Field(..., description="クラファン適合スコア (0-10)")
    total_score: int = Field(..., description="合計スコア")
    segment: Literal["A", "B", "C", "D"] = Field(..., description="セグメント判定 (A: 省エネ, B: ガジェット, C: 便利, D: ライト)")

class HEMSInterviewData(BaseModel):
    summary: str = Field(..., description="会議の概要 (3文以内)")
    topics: list[str] = Field(..., description="主な議題 (箇条書き)")
    decisions: list[str] = Field(..., description="決定事項 (箇条書き)")
    action_items: list[str] = Field(..., description="アクションアイテム")
    issues: list[str] = Field(..., description="次回までの課題")
    scoring: Scoring = Field(..., description="スコアリングとセグメント判定")
