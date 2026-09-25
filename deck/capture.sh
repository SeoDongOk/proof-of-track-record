#!/usr/bin/env bash
# 덱에 쓰는 터미널 캡처를 다시 만든다.
#   bash deck/capture.sh && python deck/render-terminal.py && python deck/build-deck.py
#
# 캡처는 손으로 쓴 것이 아니라 실제 실행 결과다. 회로를 고치면 여기부터 다시 돌린다.
set -e
cd "$(dirname "$0")/.."
mkdir -p deck/captures

npm run --silent nav       > deck/captures/nav.txt 2>&1
npm run --silent verify    > deck/captures/verify.txt 2>&1
npm run --silent selection > deck/captures/selection.txt 2>&1
npm test 2>&1 | grep -E '^(ok|# )' | tail -12 > deck/captures/test.txt

# disclose() 를 일부러 하나 지워 컴파일러가 막는 걸 재현한다. 끝나면 되돌린다.
cp contracts/attestation.compact /tmp/att.bak
trap 'cp /tmp/att.bak contracts/attestation.compact' EXIT
python3 - <<'PY'
import io
p='contracts/attestation.compact'; s=io.open(p,encoding='utf-8').read()
old="  attestations.insert(disclose(accountId), disclose(navCommitment));"
assert old in s, "대상 없음 — 컨트랙트가 바뀌었다면 이 스크립트도 고칠 것"
io.open(p,'w',encoding='utf-8').write(s.replace(old,"  attestations.insert(accountId, disclose(navCommitment));",1))
PY
compact compile contracts/attestation.compact /tmp/out_broken 2>&1 | head -14 \
  > deck/captures/disclose-error.txt || true
cp /tmp/att.bak contracts/attestation.compact
compact compile contracts/attestation.compact build/attestation >/dev/null 2>&1

echo "캡처 완료:"
wc -l deck/captures/*.txt
