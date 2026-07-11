const data = {
    accounts: localStorage.getItem("accounts")
};
chrome.runtime.sendMessage(data);
chrome.storage.local.get("agarMode", ({ agarMode }) => {
    const injectScript = (src) => {
        const s = document.createElement('script');
        s.src = chrome.runtime.getURL(src);
        s.onload = () => s.remove();
        (document.head || document.documentElement).append(s);
    }
    document.open();
    document.write(`
        <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            margin: 0;
            height: 100vh;
            overflow: hidden;
            background: radial-gradient(
                circle at bottom right,
                #36003e,
                transparent 27%
            ),
            radial-gradient(circle at top left, #36003e, transparent 27%),
            linear-gradient(90deg, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 1) 100%);
            background-size: cover;
            animation: gradientMove 12s ease infinite;
            display: flex;
            font-family: "Fira Sans", sans-serif;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            position: relative;
        }
        @keyframes gradientMove {
            0% {
            background-position: 0% 50%;
            }
            50% {
            background-position: 100% 50%;
            }
            100% {
            background-position: 0% 50%;
            }
        }
        .bubble {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.13);
            animation-name: floatUp;
            animation-timing-function: ease-in-out;
            animation-iteration-count: infinite;
            will-change: transform, opacity;
        }
        @keyframes floatUp {
            0% {
            transform: translateY(100vh) scale(var(--scale, 1));
            opacity: 0;
            }
            10% {
            opacity: 1;
            }
            90% {
            opacity: 1;
            }
            100% {
            transform: translateY(-20vh) scale(var(--scale, 1));
            opacity: 0;
            }
        }
        .title {
            font-size: 25px;
            font-weight: bold;
            color: white;
            text-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
            z-index: 1;
        }
        </style>
        <div
        class="bubble"
        style="
            width: 50px;
            height: 50px;
            left: 8%;
            --scale: 1.05;
            animation-duration: 11s;
            animation-delay: -1s;
        "
        ></div>
        <div
        class="bubble"
        style="
            width: 28px;
            height: 28px;
            left: 17%;
            --scale: 0.5;
            animation-duration: 8s;
            animation-delay: -4s;
        "
        ></div>
        <div
        class="bubble"
        style="
            width: 62px;
            height: 62px;
            left: 27%;
            --scale: 1.2;
            animation-duration: 13s;
            animation-delay: -2s;
        "
        ></div>
        <div
        class="bubble"
        style="
            width: 32px;
            height: 32px;
            left: 35%;
            --scale: 0.7;
            animation-duration: 9s;
            animation-delay: -6s;
        "
        ></div>
        <div
        class="bubble"
        style="
            width: 40px;
            height: 40px;
            left: 46%;
            --scale: 0.85;
            animation-duration: 10s;
            animation-delay: -8s;
        "
        ></div>
        <div
        class="bubble"
        style="
            width: 55px;
            height: 55px;
            left: 53%;
            --scale: 1.15;
            animation-duration: 12s;
            animation-delay: -3s;
        "
        ></div>
        <div
        class="bubble"
        style="
            width: 36px;
            height: 36px;
            left: 61%;
            --scale: 0.75;
            animation-duration: 8s;
            animation-delay: -5s;
        "
        ></div>
        <div
        class="bubble"
        style="
            width: 25px;
            height: 25px;
            left: 68%;
            --scale: 0.52;
            animation-duration: 7s;
            animation-delay: -7s;
        "
        ></div>
        <div
        class="bubble"
        style="
            width: 60px;
            height: 60px;
            left: 75%;
            --scale: 1.19;
            animation-duration: 14s;
            animation-delay: -9s;
        "
        ></div>
        <div
        class="bubble"
        style="
            width: 43px;
            height: 43px;
            left: 82%;
            --scale: 0.9;
            animation-duration: 11s;
            animation-delay: -2.5s;
        "
        ></div>
        <div
        class="bubble"
        style="
            width: 20px;
            height: 20px;
            left: 89%;
            --scale: 0.42;
            animation-duration: 7.5s;
            animation-delay: -6.5s;
        "
        ></div>
        <div
        class="bubble"
        style="
            width: 38px;
            height: 38px;
            left: 92%;
            --scale: 0.79;
            animation-duration: 9.5s;
            animation-delay: -5.5s;
        "
        ></div>
        <div
        class="bubble"
        style="
            width: 54px;
            height: 54px;
            left: 13%;
            --scale: 1.12;
            animation-duration: 12.5s;
            animation-delay: -1.5s;
        "
        ></div>
        <div
        class="bubble"
        style="
            width: 33px;
            height: 33px;
            left: 22%;
            --scale: 0.68;
            animation-duration: 8.5s;
            animation-delay: -3.5s;
        "
        ></div>
        <div
        class="bubble"
        style="
            width: 42px;
            height: 42px;
            left: 57%;
            --scale: 0.88;
            animation-duration: 10.5s;
            animation-delay: -4.5s;
        "
        ></div>
        <div
        class="bubble"
        style="
            width: 48px;
            height: 48px;
            left: 80%;
            --scale: 1;
            animation-duration: 13.5s;
            animation-delay: -7.5s;
        "
        ></div>
        <div class="title">Extension is Loading</div>
    `);
    document.close();
    const version = agarMode || "delta";
    if (version == 'delta') {
        injectScript("js/inject-delta.js");
    } else if (version == 'doublesplit') {
        injectScript("js/inject-doublesplit.js");
    }
    injectScript("js/index.js");
});