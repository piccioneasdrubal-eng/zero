const win = typeof unsafeWindow === 'undefined' ? window : unsafeWindow;
const base = 'https://extension.nelbots.ovh/lite-ext';
const agar = fetch('https://agar.io/').then(res => res.text());
const lite = fetch(base + '/index.html').then(res => res.text());
function charsetReplacer(s, charset = "utf-8") {
    return s.replace(/<script[^>]+>/gim, ($0) => {
        if (!$0.includes('src="')) return $0;
        if (!$0.includes("charset"))
            return $0.replace(/^<script/i, '$& charset="' + charset + '" ');
        return $0;
    });
}
Promise.all([agar, lite]).then(([agarHtml, liteHtml]) => {
    const parsed = new DOMParser().parseFromString(liteHtml, 'text/html');
    const urls = [...parsed.querySelectorAll('script')].map((s) => {
        const src = s.getAttribute('src');
        if (!src) return null;
        if (src.startsWith('http')) return src;
        return base.replace(/\/$/, '') + '/' + src.replace(/^\//, '');
    }).filter(Boolean);
    const scripts = urls.map((url) => `<script src="${url}" charset="utf-8"></script>`).join('');
    let str = agarHtml.replace('<head>', `<head>${scripts}`);
    str = charsetReplacer(str);
    win.document.open();
    win.document.write(str);
    win.document.close();
});
