document.getElementById("createClientForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const result = document.getElementById("result");

  // 🔐 TOKEN DEL ADMIN
  const token = localStorage.getItem("token");

  if (!token) {
    result.textContent = "No hay sesión de administrador";
    return;
  }

  try {
    const res = await fetch("/api/auth/create-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      result.textContent = data.error || "Error al crear cliente";
      return;
    }

    result.textContent = "Cliente creado correctamente";
    document.getElementById("createClientForm").reset();

  } catch (err) {
    result.textContent = "Error de conexión con el servidor";
  }
});
