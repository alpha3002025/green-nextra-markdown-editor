#!/bin/bash

# 설정
REPO="alpha3002025/green-nextra-markdown-editor"
TEMP_DIR="temp_update"
ZIP_FILE="project-release.zip"

echo "🔍 최신 릴리즈 정보를 확인 중..."

# 최신 릴리즈 정보 가져오기 및 다운로드 URL 추출 (Python 사용)
# GitHub API 호출 -> JSON 파싱 -> 태그명과 다운로드 URL 추출
read -r LATEST_TAG DOWNLOAD_URL <<< $(curl -s "https://api.github.com/repos/$REPO/releases/latest" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tag = data['tag_name']
    url = next(asset['browser_download_url'] for asset in data['assets'] if asset['name'] == '$ZIP_FILE')
    print(f'{tag} {url}')
except Exception as e:
    print('')
")

if [ -z "$DOWNLOAD_URL" ]; then
  echo "❌ 다운로드 URL을 찾을 수 없습니다. 릴리즈가 존재하지 않거나 자산(Asset) 이름이 '$ZIP_FILE'이 아닙니다."
  exit 1
fi

echo "🚀 최신 릴리즈 버전: $LATEST_TAG"
echo ""

echo "⬇️ 다운로드 중: $DOWNLOAD_URL"

# 임시 디렉토리 생성 및 다운로드
mkdir -p "$TEMP_DIR"
curl -L -o "$TEMP_DIR/$ZIP_FILE" "$DOWNLOAD_URL"

if [ $? -ne 0 ]; then
  echo "❌ 다운로드 실패"
  rm -rf "$TEMP_DIR"
  exit 1
fi

echo "📦 압축 해제 중..."
unzip -q "$TEMP_DIR/$ZIP_FILE" -d "$TEMP_DIR/extracted"

# 파일 업데이트 (patch-upstream.sh 로직 적용)
echo "🔄 파일 업데이트 중..."
SOURCE_DIR="$TEMP_DIR/extracted"

# 1. 코드 파일 동기화
rsync -av --delete "$SOURCE_DIR/src/components/" src/components/
rsync -av --delete "$SOURCE_DIR/src/styles/" src/styles/
rsync -av --delete "$SOURCE_DIR/src/pages/admin/" src/pages/admin/
rsync -av --delete "$SOURCE_DIR/src/pages/api/" src/pages/api/
rsync -av --delete "$SOURCE_DIR/src/pages/_app.tsx" src/pages/_app.tsx
rsync -av --delete "$SOURCE_DIR/src/pages/_document.tsx" src/pages/_document.tsx

# 2. 환경 설정 파일 복사
cp -a "$SOURCE_DIR/package.json" package.json
cp -a "$SOURCE_DIR/package-lock.json" package-lock.json 
cp -a "$SOURCE_DIR/next.config.js" next.config.js
cp -a "$SOURCE_DIR/.gitignore" .gitignore

# 3. 정적 리소스 복사 (public 폴더)
rsync -av --delete "$SOURCE_DIR/public/" public/
# eslint.config.mjs 파일이 존재할 경우에만 복사
if [ -f "$SOURCE_DIR/eslint.config.mjs" ]; then
    cp -a "$SOURCE_DIR/eslint.config.mjs" eslint.config.mjs
fi
cp -a "$SOURCE_DIR/theme.config.tsx" theme.config.tsx
cp -a "$SOURCE_DIR/site.config.js" site.config.js
cp -a "$SOURCE_DIR/copy-images.js" copy-images.js


# 4. 릴리즈 업데이트 스크립트 복사
cp -a "$SOURCE_DIR/update-from-release.sh" update-from-release.sh
if [ -f "$SOURCE_DIR/update-from-specific-version.sh" ]; then
    cp -a "$SOURCE_DIR/update-from-specific-version.sh" update-from-specific-version.sh
fi
cp -a "$SOURCE_DIR/patch-upstream.sh" patch-upstream.sh


echo "🧹 임시 파일 정리 중..."
rm -rf "$TEMP_DIR"

ehco ""
echo "'npm install'을 실행하여 의존성을 갱신합니다"
npm i 

echo "✅ 업데이트 완료! (릴리즈 버전 : $LATEST_TAG)"

