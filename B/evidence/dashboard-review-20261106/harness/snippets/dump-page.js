JSON.stringify({
  html: document.documentElement.outerHTML,
  local: Object.keys(localStorage).map((k) => k + "=" + localStorage.getItem(k)),
  session: Object.keys(sessionStorage).map((k) => k + "=" + sessionStorage.getItem(k)),
})