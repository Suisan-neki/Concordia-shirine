"""
HEMS Interview Pydantic Models

OpenAI Structured Outputs 用の Pydantic モデル定義。
インタビュー設計書に基づいた構造化スキーマ。
"""

from typing import Optional

from pydantic import BaseModel, Field


class BasicAttributes(BaseModel):
    """基本属性"""

    age: Optional[int] = Field(None, description="年齢")
    household_size: Optional[int] = Field(None, description="世帯人数")
    residence_type: Optional[str] = Field(
        None, description="住居形態（賃貸マンション/賃貸アパート/分譲/戸建て）"
    )
    area: Optional[str] = Field(None, description="居住エリア")
    residence_years: Optional[float] = Field(None, description="居住年数")
    layout: Optional[str] = Field(None, description="間取り")
    weekday_home_hours: Optional[float] = Field(None, description="平日在宅時間")
    weekend_home_hours: Optional[float] = Field(None, description="休日在宅時間")
    occupation_type: Optional[str] = Field(
        None, description="職業形態（会社員出社/会社員リモート/フリーランス/その他）"
    )


class ElectricityCost(BaseModel):
    """電気代関連"""

    recent_monthly_cost: Optional[int] = Field(None, description="直近の電気代（月額円）")
    summer_peak_cost: Optional[int] = Field(None, description="夏のピーク月電気代（円）")
    winter_peak_cost: Optional[int] = Field(None, description="冬のピーク月電気代（円）")
    power_company: Optional[str] = Field(None, description="電力会社名")
    has_switched_company: Optional[bool] = Field(None, description="電力会社切替経験")
    bill_check_frequency: Optional[str] = Field(
        None, description="明細確認頻度（毎月/数ヶ月に1回/ほぼ見ない）"
    )
    pain_score: Optional[int] = Field(None, ge=0, le=10, description="電気代の痛みスコア（0-10）")
    past_year_actions: Optional[list[str]] = Field(
        None, description="過去1年の電気代削減行動リスト"
    )
    saving_from_switch: Optional[int] = Field(None, description="切替による削減額（円）")
    purchased_items_for_saving: Optional[list[str]] = Field(
        None, description="節電のための購入物リスト"
    )


class DeviceInfo(BaseModel):
    """デバイス関連"""

    devices_used: Optional[list[str]] = Field(
        None, description="利用デバイス（Nature Remo/SwitchBot/AiSEG等）"
    )
    purchase_date: Optional[str] = Field(None, description="購入時期（YYYY-MM形式）")
    purchase_amount: Optional[int] = Field(None, description="購入金額（総額円）")
    purchase_channel: Optional[str] = Field(
        None, description="購入チャネル（Amazon/家電量販店/公式サイト/その他）"
    )
    app_usage_frequency: Optional[str] = Field(
        None, description="アプリ起動頻度（毎日/週数回/月数回/ほぼ開かない）"
    )
    connected_devices_count: Optional[int] = Field(None, description="連携家電数")
    automation_count: Optional[int] = Field(None, description="オートメーション設定数")
    most_used_feature: Optional[str] = Field(None, description="最頻使用機能")
    satisfaction_points: Optional[list[str]] = Field(None, description="満足ポイント（トップ3）")
    dissatisfaction_points: Optional[list[str]] = Field(None, description="不満ポイント（トップ3）")
    unused_features: Optional[list[str]] = Field(None, description="使わなくなった機能")
    initial_setup_time_minutes: Optional[int] = Field(None, description="初期設定時間（分）")
    replacement_intention: Optional[str] = Field(
        None, description="故障時買替意向（即買い直す/検討する/買い直さない）"
    )


class PriceSensitivity(BaseModel):
    """価格感覚"""

    cheap_price_range: Optional[str] = Field(None, description="安いと感じる価格帯")
    fair_price_range: Optional[str] = Field(None, description="妥当と感じる価格帯")
    expensive_price_range: Optional[str] = Field(None, description="高いと感じる価格帯")
    max_purchase_price: Optional[int] = Field(None, description="購入上限価格（円）")


class Scoring(BaseModel):
    """スコアリング"""

    electricity_interest_score: Optional[int] = Field(
        None, ge=0, le=10, description="電気代関心度スコア（0-10）"
    )
    electricity_interest_details: Optional[str] = Field(
        None, description="電気代関心度スコアの算出根拠"
    )
    engagement_score: Optional[int] = Field(
        None, ge=0, le=10, description="エンゲージメントスコア（0-10）"
    )
    engagement_details: Optional[str] = Field(
        None, description="エンゲージメントスコアの算出根拠"
    )
    crowdfunding_fit_score: Optional[int] = Field(
        None, ge=0, le=10, description="クラファン適合スコア（0-10）"
    )
    crowdfunding_fit_details: Optional[str] = Field(
        None, description="クラファン適合スコアの算出根拠"
    )
    total_score: Optional[int] = Field(None, ge=0, le=30, description="総合スコア（0-30）")
    segment: Optional[str] = Field(
        None, description="セグメント（A:省エネ意識高/B:ガジェット好き/C:便利さ追求/D:ライト層）"
    )
    segment_reason: Optional[str] = Field(None, description="セグメント判定理由")


class Insights(BaseModel):
    """重要インサイト"""

    most_impressive_quote: Optional[str] = Field(None, description="最も印象的だった発言（原文）")
    unexpected_findings: Optional[str] = Field(None, description="予想と違った点")
    non_negotiable_value: Optional[str] = Field(None, description="絶対に譲れない価値")
    reason_not_to_pay: Optional[str] = Field(None, description="絶対に払わない理由")
    suggestion_for_500_supporters: Optional[str] = Field(
        None, description="500人支援者獲得に向けた示唆"
    )
    good_signals: Optional[list[str]] = Field(None, description="有望なシグナル")
    bad_signals: Optional[list[str]] = Field(None, description="要注意なシグナル")


class CrowdfundingExperience(BaseModel):
    """クラウドファンディング経験"""

    monthly_subscription_total: Optional[int] = Field(None, description="月額サブスク総額（円）")
    canceled_subscriptions: Optional[list[str]] = Field(None, description="解約したサブスクリスト")
    has_crowdfunding_experience: Optional[bool] = Field(None, description="クラファン支援経験")
    crowdfunding_count: Optional[int] = Field(None, description="クラファン支援回数")
    average_support_amount: Optional[int] = Field(None, description="1回あたり平均支援額（円）")
    supported_categories: Optional[list[str]] = Field(None, description="支援したカテゴリ")
    uses_point_sites: Optional[str] = Field(
        None, description="ポイントサイト利用（よく使う/たまに使う/使わない）"
    )
    ad_resistance: Optional[str] = Field(None, description="広告への抵抗感（高/中/低）")


class FamilyAndBarriers(BaseModel):
    """家族利用と導入障壁"""

    family_usage: Optional[bool] = Field(None, description="家族利用状況")
    family_usage_frequency: Optional[str] = Field(None, description="家族の利用頻度")
    family_most_used_feature: Optional[str] = Field(None, description="家族が最も使う機能")
    non_usage_reason: Optional[str] = Field(None, description="非利用理由")
    rental_barriers: Optional[list[str]] = Field(
        None, description="賃貸での設置障壁（工事/配線/Wi-Fi/設置場所）"
    )
    abandoned_ideas: Optional[str] = Field(None, description="賃貸で諦めたアイデア")
    has_recommended: Optional[bool] = Field(None, description="他者への推奨経験")
    recommendation_phrase: Optional[str] = Field(None, description="推奨時に使ったフレーズ")
    nps_score: Optional[int] = Field(None, ge=0, le=10, description="NPS（0-10）")


class HEMSInterviewData(BaseModel):
    """HEMS インタビューデータ（構造化出力のルートモデル）"""

    interview_id: Optional[str] = Field(None, description="インタビュー番号")
    interview_duration_minutes: Optional[int] = Field(None, description="インタビュー所要時間（分）")
    basic_attributes: BasicAttributes = Field(default_factory=BasicAttributes)
    electricity_cost: ElectricityCost = Field(default_factory=ElectricityCost)
    device_info: DeviceInfo = Field(default_factory=DeviceInfo)
    price_sensitivity: PriceSensitivity = Field(default_factory=PriceSensitivity)
    crowdfunding_experience: CrowdfundingExperience = Field(
        default_factory=CrowdfundingExperience
    )
    family_and_barriers: FamilyAndBarriers = Field(default_factory=FamilyAndBarriers)
    scoring: Scoring = Field(default_factory=Scoring)
    insights: Insights = Field(default_factory=Insights)
    summary: Optional[str] = Field(None, description="インタビュー全体の要約（3文以内）")
    action_items: Optional[list[str]] = Field(None, description="次のアクション項目")
