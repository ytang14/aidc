#!/usr/bin/env python3
"""每日刷新 AI 算力看板数据。

流程：
  1. 调用 Claude（带 web_search / web_fetch 服务端工具）检索当天中美 GPU 租赁价、
     购买价、监管动态，产出带来源的研究笔记。
  2. 再调用一次 Claude，用 JSON Schema 结构化输出把笔记整理成 data/latest.json 的格式。
  3. 写入 data/latest.json，并归档到 data/history/YYYY-MM-DD.json，更新 data/history/index.json。

用法：
  export ANTHROPIC_API_KEY=...        # 或已执行 `ant auth login`
  pip install anthropic
  python3 refresh.py                  # 建议 cron：每天北京时间 07:30 运行

只依赖 anthropic 一个包。上一日数据会作为参照传给模型，用于判断涨跌和发现异常。
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import sys

import anthropic

ROOT = pathlib.Path(__file__).resolve().parent
DATA = ROOT / "data"
HIST = DATA / "history"
MODEL = "claude-opus-5-5"

ITEM_PROPS = {
    "source": {"type": "string", "description": "来源名称"},
    "url": {"type": "string"},
    "as_of": {"type": "string", "description": "来源标注的日期 YYYY-MM-DD"},
    "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
    "note": {"type": "string"},
}
REQ = ["source", "url", "as_of", "confidence", "note"]

GPU_KEYS = ["GB300", "GB200", "B300", "B200", "H200", "H100", "H800", "H20", "A100", "A800",
            "MI300X", "MI355X", "910C", "910B", "RTX 4090", "RTX 5090", "RTX PRO 6000", "other"]

SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["updated_at", "fx_usdcny", "fx_as_of", "fx_source", "fx_url", "headline", "rental", "purchase", "regulation", "opportunities", "routes", "contracts"],
    "properties": {
        "updated_at": {"type": "string"},
        "fx_usdcny": {"type": "number", "description": "人民币兑美元中间价"},
        "fx_as_of": {"type": "string"}, "fx_source": {"type": "string"}, "fx_url": {"type": "string"},
        "headline": {"type": "array", "items": {"type": "string"}, "description": "今日 3-5 条要点，中文，每条不超过 40 字"},
        "rental": {"type": "array", "items": {
            "type": "object", "additionalProperties": False,
            "required": ["region", "gpu", "gpu_key", "price", "low", "high", "unit"] + REQ,
            "properties": {
                "region": {"type": "string", "enum": ["US", "CN"]},
                "gpu": {"type": "string"},
                "gpu_key": {"type": "string", "enum": GPU_KEYS},
                "price": {"type": "number", "description": "代表价：优先成交指数，其次挂牌中位"},
                "low": {"type": "number", "description": "市场地板价：最便宜的 neocloud/spot/marketplace"},
                "high": {"type": "number", "description": "超大云（AWS/Azure/GCP）按需价；无则取最高挂牌"},
                "unit": {"type": "string", "enum": ["USD/GPU·h", "CNY/卡·h"]},
                **ITEM_PROPS}}},
        "purchase": {"type": "array", "items": {
            "type": "object", "additionalProperties": False,
            "required": ["region", "item", "gpu", "cards", "price", "unit", "channel"] + REQ,
            "properties": {
                "region": {"type": "string", "enum": ["US", "CN", "Global"]},
                "item": {"type": "string", "description": "如 H200 8卡整机 / B200 单卡"},
                "gpu": {"type": "string", "enum": GPU_KEYS + ["other"]},
                "cards": {"type": "integer", "description": "这个价格包含几张卡；未知填 0"},
                "price": {"type": "number"},
                "unit": {"type": "string", "enum": ["USD", "CNY"]},
                "channel": {"type": "string", "description": "官方/OEM 报价、渠道价、灰色市场等"},
                **ITEM_PROPS}}},
        "regulation": {"type": "array", "items": {
            "type": "object", "additionalProperties": False,
            "required": ["date", "jurisdiction", "title", "summary", "impact", "direction", "source", "url"],
            "properties": {
                "date": {"type": "string"},
                "jurisdiction": {"type": "string", "enum": ["US", "CN", "Other"]},
                "title": {"type": "string"}, "summary": {"type": "string"},
                "impact": {"type": "string", "description": "对价格/供给的影响"},
                "direction": {"type": "string", "enum": ["tighten", "loosen", "neutral"]},
                "source": {"type": "string"}, "url": {"type": "string"}}}},
        "contracts": {"type": "array", "description": "长协价格：1/3/5 年，实测与估算分开", "items": {
            "type": "object", "additionalProperties": False,
            "required": ["region", "gpu_key", "term", "price", "low", "high", "unit", "channel", "basis", "method", "source", "url", "as_of", "confidence"],
            "properties": {
                "region": {"type": "string", "enum": ["US", "CN"]},
                "gpu_key": {"type": "string", "enum": GPU_KEYS},
                "term": {"type": "string", "enum": ["1y", "3y", "5y"]},
                "price": {"type": "number", "description": "折算为每卡每小时"},
                "low": {"type": "number", "description": "区间下限，无区间则等于 price"}, "high": {"type": "number"},
                "unit": {"type": "string", "enum": ["USD/GPU·h", "CNY/卡·h"]},
                "channel": {"type": "string", "enum": ["market", "hyperscaler"], "description": "hyperscaler=AWS/Azure/GCP 承诺价，其余为市场价"},
                "basis": {"type": "string", "enum": ["published", "deal", "estimate"],
                          "description": "published=公开价目/报价，deal=由披露合同金额折算，estimate=推算"},
                "method": {"type": "string", "description": "一句话写明怎么得到/折算的，含公式和假设"},
                "source": {"type": "string"}, "url": {"type": "string"}, "as_of": {"type": "string"},
                "confidence": {"type": "string", "enum": ["high", "medium", "low"]}}}},
        "routes": {"type": "array", "description": "算力倒卖通道状态，每条一句话", "items": {
            "type": "object", "additionalProperties": False,
            "required": ["route", "status", "since", "note", "url"],
            "properties": {"route": {"type": "string"},
                           "status": {"type": "string", "enum": ["open", "license", "closed"]},
                           "since": {"type": "string"}, "note": {"type": "string", "description": "不超过 30 字"},
                           "url": {"type": "string"}}}},
        "opportunities": {"type": "array", "items": {
            "type": "object", "additionalProperties": False,
            "required": ["title", "detail", "basis"],
            "properties": {"title": {"type": "string"}, "detail": {"type": "string"},
                           "basis": {"type": "string", "description": "依据哪条价格或监管数据"}}}},
    },
}

RESEARCH_PROMPT = """今天是 {today}。你是 AI 算力市场分析师。请用 web_search / web_fetch 检索最新数据：

1. 美国 GPU 租赁价（USD/GPU·小时）：H100 SXM、H200、B200、GB200、B300、GB300、A100、MI300X。
   区分指数/中位价、超大云厂商按需价与 neocloud 低价。优先 Ornn OCPI、computecensus、
   gpurentalprices、savrn.com/ai-index、gpueconomy、各云厂商官网价目。
   同一型号的代表价、长协价要尽量用同一口径（零售挂牌 vs 批发大单不要混在一起比较）。
   做合理性检查：新一代（GB300 > GB200 > H200 > H100，B300 > B200）同口径下通常更贵，
   若出现倒挂，先核对是否口径不同，并在 note 里写明原因。
2. 中国 GPU 租赁价（元/卡·小时）：H100/H800、H20、A100/A800、4090、昇腾 910B/910C。
3. 购买价：H200/B200/B300 单卡与 8 卡整机（美国渠道价、中国渠道价与灰色市场价）、H20、昇腾 910C。
4. 监管：近 30 天美国出口管制（BIS 规则、许可、远程访问）、中国进口/国产替代/数据中心与算力政策、
   其他影响供给的规定。
5. 基于以上数据的 3-5 个产业机会（写明依据），读者是算力倒卖者：关注进货价与售价的价差、回本周期、通道风险。
6. 长协价格（1 年 / 3 年 / 5 年）：美国查各云厂商和 neocloud 的 1 年/3 年承诺价、披露的大额合同（金额÷卡数÷年数÷8760）；中国查 Mysteel 闭口/年签月租、A股算力租赁合同公告。没有直接数据时，用同型号现货价 × 公开的期限折扣率给出 best estimate，标 basis=estimate 并写明公式；estimate 必须给出 low/high 区间，不能是单点。上一期数据里的长协条目如果没有更新的来源，可以沿用。
7. 通道状态：美国境内、海外机房→中资、H200→中国大陆、东南亚进货、第三方转租、国产卡等通道当前是开放/需许可/关闭。
租赁价每行给出三个数：代表价（成交指数优先）、市场地板价（最便宜 neocloud/spot）、超大云按需价。

每个数字必须附来源名称、URL 和来源标注的日期；找不到就不写，不要估算。
二手/自媒体来源标 confidence=low。查当日人民币兑美元中间价（中国外汇交易中心），附日期和 URL。

上一期数据（用于对比涨跌，不要直接照抄）：
{previous}
"""


def research(client: anthropic.Anthropic, previous: str) -> str:
    today = dt.date.today().isoformat()
    messages = [{"role": "user", "content": RESEARCH_PROMPT.format(today=today, previous=previous)}]
    tools = [
        {"type": "web_search_20260209", "name": "web_search", "max_uses": 25},
        {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": 25},
    ]
    for _ in range(6):  # pause_turn 续跑上限
        with client.messages.stream(
            model=MODEL, max_tokens=64000, messages=messages, tools=tools,
            output_config={"effort": "high"},
        ) as stream:
            resp = stream.get_final_message()
        if resp.stop_reason == "pause_turn":
            messages = [messages[0], {"role": "assistant", "content": resp.content}]
            continue
        if resp.stop_reason == "refusal":
            sys.exit("research step refused")
        return "\n".join(b.text for b in resp.content if b.type == "text")
    sys.exit("research step did not finish")


def structure(client: anthropic.Anthropic, notes: str) -> dict:
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    with client.messages.stream(
        model=MODEL, max_tokens=32000,
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content":
                   f"把下面的研究笔记整理成 JSON。updated_at 用 {now}。只收录笔记里有来源的数字，"
                   f"不要新增数字。文字用中文。\n\n{notes}"}],
    ) as stream:
        resp = stream.get_final_message()
    if resp.stop_reason == "refusal":
        sys.exit("structure step refused")
    return json.loads(next(b.text for b in resp.content if b.type == "text"))


def main() -> None:
    HIST.mkdir(parents=True, exist_ok=True)
    latest = DATA / "latest.json"
    previous = latest.read_text(encoding="utf-8") if latest.exists() else "（无）"
    client = anthropic.Anthropic()
    notes = research(client, previous[:60000])
    data = structure(client, notes)
    if len(data["rental"]) < 3:
        sys.exit("too few price rows; keeping previous data")  # 防止坏数据覆盖
    text = json.dumps(data, ensure_ascii=False, indent=2)
    day = dt.date.today().isoformat()
    (HIST / f"{day}.json").write_text(text, encoding="utf-8")
    (HIST / f"{day}.notes.md").write_text(notes, encoding="utf-8")
    latest.write_text(text, encoding="utf-8")
    days = sorted(p.stem for p in HIST.glob("????-??-??.json"))
    (HIST / "index.json").write_text(json.dumps(days), encoding="utf-8")
    print(f"ok {day}: {len(data['rental'])} rental, {len(data['purchase'])} purchase, "
          f"{len(data['regulation'])} regulation")


if __name__ == "__main__":
    main()
