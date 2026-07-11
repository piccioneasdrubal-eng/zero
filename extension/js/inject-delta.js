const charsetReplacer = (s, charset = "utf-8") => {
    return s.replace(/<script[^>]+>/gim, ($0) => {
        if (!$0.includes('src="')) return $0;
        if (!$0.includes("charset"))
            return $0.replace(/^<script/i, '$& charset="' + charset + '" ');
        return $0;
    });
}
const originSpoofingLoader = ({ location, onDocumentOpen = [] }) => {
    const win = typeof unsafeWindow === "undefined" ? window : unsafeWindow;
    const request = new Promise((r) => {
        fetch(`${location}?${Math.random()}`)
            .then((response) => response.text())
            .then((text) => r({ responseText: text }));
    });
    const cat = (f) =>
        new Promise((r) =>
            Object.assign(new FileReader(), {
                onload: (e) => r(e.target.result),
            }).readAsText(f),
        );
    const reader = request.then((res) =>
        cat(
            new Blob(["\ufeff" + res.responseText], {
                type: "text/html;charset=windows-1252",
            }),
        ),
    );
    reader.then((textHtml) => {
        textHtml = charsetReplacer(textHtml);
        const matchedBase = textHtml.match(/<base[^>]*>/im)?.[0];
        if (matchedBase) {
            const parsed = new DOMParser().parseFromString(matchedBase, "text/html");
            const $base = parsed.querySelector("base");
            $base.setAttribute("href", location);
            textHtml = textHtml.replace(matchedBase, $base.outerHTML);
        }
        win.document.open();
        onDocumentOpen.forEach((fn) => fn.bind(win)());
        injectScript.bind(win)(location);
        win.document.write(textHtml);
        win.document.close();
    });
}
const injectScript = (location) => { }
const isDev = window.location.pathname.indexOf("dev") > -1;
const webBase = "https://deltav4.gitlab.io";
const devBase = "http://127.0.0.1:8080/";
const target = `${isDev ? devBase : webBase}/v7/`;
originSpoofingLoader({ location: target });
