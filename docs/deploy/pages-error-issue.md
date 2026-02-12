# Vercel 배포 시 이미지 경로 깨짐 문제 해결

## 문제 상황
GitHub Pages 배포를 위해 `next.config.js`에 `basePath`를 설정한 이후, Vercel에서 배포된 사이트의 이미지가 깨져 보이는 현상이 발생했습니다.

## 원인
GitHub Pages는 서브 디렉토리(예: `/repo-name`)에서 호스팅되므로 `basePath` 설정이 필요하지만, Vercel은 루트 도메인(`/`)에서 호스팅되므로 `basePath`가 적용되면 리소스 경로가 잘못 지정됩니다.

## 해결 방법

### 1. `package.json` 스크립트 분리
Vercel은 기본적으로 `npm run build`를 실행하므로, GitHub Pages 배포용 스크립트를 `build-pages`로 별도로 분리했습니다.

```json filename="package.json"
{
  "scripts": {
    "build": "next build", // Vercel용 (기본 빌드)
    "build-pages": "next build && node copy-images.js" // GitHub Pages용 (이미지 복사 포함)
  }
}
```

### 2. GitHub Actions 워크플로우 수정
GitHub Pages 배포 워크플로우가 `build-pages` 스크립트를 사용하도록 변경했습니다.

```yaml filename=".github/workflows/deploy-pages.yml"
jobs:
  build:
    steps:
      - name: Build with Next.js
        run: |
          npm run build-pages
          touch out/.nojekyll
```

### 3. `next.config.js` 조건부 설정
Vercel 환경 변수(`VERCEL`)를 감지하여, Vercel 배포 시에는 `basePath`를 적용하지 않도록 수정했습니다.

```javascript filename="next.config.js"
const { SITE_CONFIG } = require('./site.config')

const isProd = process.env.NODE_ENV === 'production'
const isVercel = process.env.VERCEL === '1' // Vercel 환경 감지

module.exports = withNextra({
    // ... 기타 설정
    // Vercel이 아니고 프로덕션 빌드일 때만 basePath 적용
    basePath: (isProd && !isVercel) ? SITE_CONFIG.basePath : '',
})
```

이렇게 하면 GitHub Pages에서는 `/green-nextra-markdown-editor` 경로가 유지되고, Vercel에서는 루트 경로(`/`)가 사용되어 두 환경 모두에서 정상적으로 작동합니다.
