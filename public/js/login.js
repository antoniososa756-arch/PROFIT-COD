async function doLogin() {
  const user = document.getElementById("user").value.trim();
  const pass = document.getElementById("pass").value.trim();
  const remember = document.getElementById("remember").checked;
  const errorMsg = document.getElementById("login-error");

  if (!user || !pass) {
    if (errorMsg) { errorMsg.style.display = "block"; errorMsg.textContent = "Completa los datos"; }
    return;
  }

  if (errorMsg) errorMsg.style.display = "none";

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: user,
        password: pass
      })
    });

    const data = await res.json();

    if (!res.ok) {
      if (errorMsg) {
        errorMsg.style.display = "block";
        if (res.status === 403) {
          errorMsg.textContent = "Cuenta desactivada. Contacta al administrador.";
        } else {
          errorMsg.textContent = "Usuario o contraseña incorrectos";
        }
      }
      return;
    }

    // ✅ GUARDAR TOKEN REAL
    localStorage.setItem("token", data.token);

    // recordar login (solo email)
    if (remember) {
      localStorage.setItem(
        "remember_login",
        JSON.stringify({ user })
      );
    } else {
      localStorage.removeItem("remember_login");
    }

    // entrar al panel
    window.location.href = "/";

  } catch (err) {
    alert("No se pudo conectar con el servidor");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const saved = JSON.parse(localStorage.getItem("remember_login"));
  if (saved) {
    document.getElementById("user").value = saved.user;
    document.getElementById("remember").checked = true;
  }
});
