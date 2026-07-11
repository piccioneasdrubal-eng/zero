const buttons = document.querySelectorAll('.mode-button');
document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.local.get("agarMode", (result) => {
        if (result.agarMode) {
            const selected = document.querySelector(`.mode-button[data-mode="${result.agarMode}"]`);
            if (selected) selected.classList.add('active');
        }
    });
});
buttons.forEach(button => {
    button.addEventListener('click', () => {
        const mode = button.getAttribute('data-mode');
        buttons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        chrome.storage.local.set({ agarMode: mode }, () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]?.id) {
                    chrome.tabs.reload(tabs[0].id, { bypassCache: true });
                }
            });
            window.close();
        });
    });
});