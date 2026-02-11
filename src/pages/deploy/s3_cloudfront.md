# S3 + CloudFront + Route53 배포 가이드

Route53 도메인이 있는 경우 **AWS S3(정적 호스팅) + CloudFront(CDN) + Route53** 조합으로 배포하는 것이 속도, 보안, HTTPS 인증서 적용 면에서 가장 이상적입니다.

## 1. 인프라 설정 (AWS Console)

### 1단계: S3 버킷 생성
1. **S3** 콘솔에서 **버킷 만들기** 클릭.
2. **버킷 이름**: `{{도메인명}} (e.g. amazon.live) (e.g. amazon.live)` (도메인과 동일하게 설정 권장)
3. **퍼블릭 액세스 차단 설정**: 
   - CloudFront OAC(Origin Access Control)를 사용하는 경우 "모든 퍼블릭 액세스 차단"을 **체크(활성화)** 상태로 둡니다. (보안 권장)
   - 만약 복잡한 설정 없이 바로 정적 웹 호스팅만 테스트하려면 체크 해제할 수도 있으나, CloudFront 연동 시에는 차단하는 것이 정석입니다.

### 2단계: CloudFront 배포 생성
1. **CloudFront** 콘솔 > **배포 생성**.
2. **원본 도메인**: 방금 만든 S3 버킷 선택.
3. **원본 액세스**: "원본 액세스 제어 설정(권장)" 선택 후 "제어 설정 생성" 클릭.
   - *주의*: 배포 생성 후 "S3 버킷 정책 업데이트" 안내가 나오면, 제공되는 정책 JSON을 복사하여 S3 버킷 권한 탭의 버킷 정책에 붙여넣어야 합니다.
4. **뷰어 프로토콜 정책**: `Redirect HTTP to HTTPS` 선택.
5. **대체 도메인 이름(CNAME)**: `{{도메인명}} (e.g. amazon.live)` 입력.
6. **사용자 정의 SSL 인증서**: "인증서 요청"을 눌러 ACM에서 `{{도메인명}} (e.g. amazon.live)`에 대한 인증서(반드시 **us-east-1** 리전)를 발급받고 선택합니다.

### 3단계: Route 53 연결
1. **Route 53** > **호스팅 영역** > `{{도메인명}} (e.g. amazon.live)` 선택.
2. **레코드 생성** 클릭.
3. **레코드 이름**: 비워둠 (루트 도메인일 경우).
4. **레코드 유형**: A.
5. **별칭(Alias)** 토글 활성화.
6. **트래픽 라우팅 대상**: "CloudFront 배포에 대한 별칭" 선택 후, 방금 만든 배포를 선택합니다.

---

## 2. 프로젝트 설정 변경

커스텀 도메인(`{{도메인명}} (e.g. amazon.live)`)을 사용할 때는 GitHub Pages와 달리 하위 경로(`/repo-name`)가 필요 없으므로 `site.config.js`를 수정해야 합니다.

**`site.config.js` 파일 수정:**

```javascript
const SITE_CONFIG = {
    // ... 기존 설정 ...

    // ⚙️ Base Path
    // * GitHub Pages 배포 시: `/${CONFIG.repoName}`
    // * Custom Domain (AWS) 배포 시: '' (빈 문자열)
    basePath: '',  // <--- 빈 문자열로 설정하여 루트 경로 사용
}
```

---

## 3. GitHub Actions 시크릿 설정

GitHub 저장소 > **Settings** > **Secrets and variables** > **Actions**에 아래 값들을 추가합니다.

| 시크릿 이름 | 설명 | 예시 |
|------------|------|------|
| `AWS_S3_BUCKET_NAME` | S3 버킷 이름 | `{{도메인명}} (e.g. amazon.live)` |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront 배포 ID | `E1A2B3C4D5...` |
| `AWS_IAM_ROLE_ARN` | GitHub Actions용 IAM Role ARN | `arn:aws:iam::123456789012:role/GithubActionsRole` |

> **참고**: IAM Role 설정이 복잡하다면 `AWS_ACCESS_KEY_ID`와 `AWS_SECRET_ACCESS_KEY`를 사용하는 방식으로 워크플로우를 수정하여 사용할 수도 있습니다.

## 4. 배포 워크플로우 파일

`.github/workflows/deploy-aws.yml` 파일을 생성하여 배포를 자동화합니다. (이미 프로젝트에 포함되어 있습니다.)
