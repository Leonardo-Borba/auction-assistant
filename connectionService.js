const axios = require("axios").default;
const querystring = require("querystring");
let cookie;

axios.interceptors.request.use(async (request) => {
  if (!cookie && !request.url.includes("logar_me")) {
    const loginForm = {
      lnick: process.env.user,
      lsenha: process.env.pass,
      raizLogin: "www.ligamagic.com.br/",
      lasturl: "https://www.ligamagic.com.br/",
      _selexiona: "101",
    };
    const response = await axios({
      method: "POST",
      url: "https://ligamagic.com.br/logar_me.php",
      data: loginForm,
    });
    console.log(`logged in as ${process.env.user}`);
  }
  if (request.method.toLowerCase() === "post") {
    request.headers = {
      ...request.headers,
      "content-type": "application/x-www-form-urlencoded",
    };
    request.data = querystring.stringify(request.data);
  }
  if (cookie)
    request.headers = {
      ...request.headers,
      cookie: cookie,
    };
  return request;
});

axios.interceptors.response.use((response) => {
  if (response.headers["set-cookie"]) {
        let newCookie = response.headers["set-cookie"].map(item => item.match(/\w{5,15}=\w{32,40};/i)).join("")
      cookie = cookie ? cookie+newCookie : newCookie
  }
  return response;
});

exports.axios = axios;