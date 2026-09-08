"""paper_trading state.json -> 증명 입력 trades.json

포지션별 시가평가 손익을 bps 로 계산한다. 체리피킹을 막기 위해
티커 알파벳순으로 정렬해 8건씩 배치로 자른다. salt 는 여기서 생성해
파일에 함께 저장한다 (리프 해시 재현에 필요, 비공개 witness).

  PYTHONPATH=<Algorithmic_Trading_YL> python src/export_trades.py --out trades.json
"""
import argparse, json, os, secrets, sys
from datetime import datetime, timezone

OFFSET = 100_000          # 회로의 pnlOffset() 과 동일. 100000 = 0bp
BATCH = 8                 # 회로 batchSize

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", default=os.path.expanduser("~/.paper_trading/state.json"))
    ap.add_argument("--out", default="trades.json")
    a = ap.parse_args()

    from paper_trading.quotes import YFinanceQuotes
    d = json.load(open(a.state))
    b = d["broker"]
    pos = {t: p for t, p in b["positions"].items() if p["qty"] > 0}
    if not pos:
        sys.exit("포지션 없음")

    first_ts = {}
    for t in b["trades"]:
        first_ts.setdefault(t["ticker"], t["ts"])

    prices = YFinanceQuotes().get_prices(sorted(pos))
    rows = []
    for tk in sorted(pos):                                   # 알파벳순 = 결정적
        if tk not in prices:
            continue
        p = pos[tk]
        pnl_pct = (prices[tk] - p["avg_price"]) / p["avg_price"]
        bps = int(round(pnl_pct * 10_000))
        ts = datetime.fromisoformat(first_ts[tk]).astimezone(timezone.utc)
        rows.append({
            "ticker": tk,                                    # 로컬 확인용. 회로엔 안 들어감
            "timestamp": int(ts.timestamp()),
            "pnlBps": OFFSET + bps,
            "pnl_bps_actual": bps,
            "salt": secrets.token_hex(32),
        })

    batches = [rows[i:i + BATCH] for i in range(0, len(rows) - len(rows) % BATCH, BATCH)]
    out = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "source": a.state,
        "positions": len(pos), "priced": len(rows),
        "offset": OFFSET, "batch_size": BATCH,
        "batches": [{"index": i, "trades": bt,
                     "sum_bps": sum(t["pnl_bps_actual"] for t in bt)} for i, bt in enumerate(batches)],
    }
    json.dump(out, open(a.out, "w"), indent=1)
    print(f"포지션 {len(pos)} / 시세확보 {len(rows)} -> 배치 {len(batches)}개 x {BATCH}건")
    for bt in out["batches"]:
        tick = ",".join(t["ticker"] for t in bt["trades"])
        print(f"  배치{bt['index']}: 합계 {bt['sum_bps']:+d}bp  [{tick}]")
    print(f"저장: {a.out}")

if __name__ == "__main__":
    main()
