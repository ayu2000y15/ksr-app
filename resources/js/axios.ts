import axios from 'axios';

// 1. 環境変数からバックエンドAPIのURLを取得します。
//    Viteでは環境変数の頭に`VITE_`を付ける必要があります。
// Use the backend URL matching APP_URL to ensure cookies set by the server are
// sent by the browser (localhost vs 127.0.0.1 must match).
axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// 2. 異なるドメイン間でCookieを送受信することを許可します。
//    これが false だと認証が絶対に成功しません。
axios.defaults.withCredentials = true;

// 3. LaravelバックエンドがAjaxリクエストだと認識するために推奨されるヘッダーです。
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

// Ensure XSRF token header is set from cookie (helps when automatic axios behavior
// doesn't pick it up due to host mismatch or timing). This reads the "XSRF-TOKEN"
// cookie and sets the header used by Laravel (X-XSRF-TOKEN).
function getCookie(name: string) {
    const match = document.cookie.match(new RegExp('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
}

try {
    const xsrf = getCookie('XSRF-TOKEN');
    if (xsrf) {
        axios.defaults.headers.common['X-XSRF-TOKEN'] = xsrf;
    }
    /* eslint-disable-next-line no-unused-vars */
} catch (_e) {
    // document.cookie may be unavailable in some server-side contexts; ignore silently
}

export default axios;
