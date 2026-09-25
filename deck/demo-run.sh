#!/usr/bin/env bash
# 데모 영상용 실행 스크립트. 사람이 읽을 시간을 두고 진행한다.
#   bash deck/demo-run.sh
set -e
cd "$(dirname "$0")/.."
B=$'\e[1m'; D=$'\e[2m'; R=$'\e[0m'
step() { echo; echo "${B}$1${R}"; echo "${D}$2${R}"; sleep "${3:-2}"; }

clear
step "1. 손실을 빼고 계산할 수 없다" "npm run nav" 3
npm run --silent nav
sleep 6

clear
step "2. 계정 없이 zkTLS 증언 검증" "npm run verify" 3
npm run --silent verify
sleep 6

clear
step "3. 온체인 기록" "Midnight Preview 공개 테스트넷" 2
cat deck/onchain.txt
sleep 5
