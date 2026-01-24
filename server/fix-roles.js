const db = require("./db");

db.serialize(() => {
  db.run(
    "UPDATE users SET role = 'admin' WHERE role = 'Administrador'",
    () => {
      console.log("✅ Administradores corregidos");
    }
  );

  db.run(
    "UPDATE users SET role = 'cliente' WHERE role = 'Cliente'",
    () => {
      console.log("✅ Clientes corregidos");
    }
  );
});
