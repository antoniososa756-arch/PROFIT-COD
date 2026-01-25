fetch("/components/sidebar.html")
  .then(r => r.text())
  .then(html => {
    const app = document.getElementById("app");
    if (!app) return;

    app.insertAdjacentHTML(
      "afterbegin",
      `<div class="layout"><div id="sidebar-slot"></div><div class="main" id="main-slot"></div></div>`
    );

    document.getElementById("sidebar-slot").innerHTML = html;
  });
