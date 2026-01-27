const API_BASE = "https://profit-cod.onrender.com";

async function loadOrders() {
  const token = localStorage.getItem("token");
  if (!token) {
    console.warn("No token");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      headers: {
        Authorization: "Bearer " + token,
      },
    });

    if (!res.ok) {
      throw new Error("Error cargando pedidos");
    }

    const orders = await res.json();
    renderOrders(orders);
  } catch (err) {
    console.error(err);
    document.getElementById("orders-body").innerHTML =
      `<tr><td colspan="6">Error cargando pedidos</td></tr>`;
  }
}

function renderOrders(orders) {
  const tbody = document.getElementById("orders-body");
  tbody.innerHTML = "";

  if (!orders.length) {
    tbody.innerHTML =
      `<tr><td colspan="6">No hay pedidos todavía</td></tr>`;
    return;
  }

  orders.forEach(o => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${o.order_number || "-"}</td>
      <td>${o.customer_name || "-"}</td>
      <td>${o.total_price || 0} ${o.currency || ""}</td>
      <td>${o.fulfillment_status || "-"}</td>
      <td>${o.tracking_number || "-"}</td>
      <td>${o.created_at ? new Date(o.created_at).toLocaleString() : "-"}</td>
    `;

    tbody.appendChild(tr);
  });
}

document.addEventListener("DOMContentLoaded", loadOrders);
