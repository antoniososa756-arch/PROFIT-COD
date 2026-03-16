require("dotenv").config({
  path: require("path").join(__dirname, ".env"),
});

const express = require("express");
const path = require("path");
const cors = require("cors");

// DB
const db = require("./db");

// Routes
const authRoutes = require("./routes/auth.routes");
const shopifyRoutes = require("./routes/shopify.routes");
const shopifyWebhooks = require("./routes/shopify.webhooks");
const adminRoutes = require("./routes/admin.routes");
const userRoutes = require("./routes/users");
const metricsRoutes = require("./routes/metrics.routes");
const ordersRoutes = require("./routes/orders.routes");
const nominaRoutes = require("./routes/nomina.routes");

const app = express();
const PORT = Number(process.env.PORT || 3001);

// ⚠️ IMPORTANTE: webhooks usan RAW body (SIEMPRE ANTES DE json)
app.use("/api/shopify/webhooks", shopifyWebhooks);

// Middlewares normales
app.use(cors());
app.use(express.json());

// Inyección global de DB
app.use((req, res, next) => {
  req.db = db;
  next();
});

// API
app.use("/api/auth", authRoutes);
app.use("/api/shopify", shopifyRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/metrics", metricsRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/tracking", require("./routes/tracking.routes"));
app.use("/api/ads", require("./routes/ads.routes"));
app.use("/api/gastos-fijos", require("./routes/gastos-fijos.routes"));
app.use("/api/impuestos", require("./routes/impuestos.routes"));
app.use("/api/gastos-varios", require("./routes/gastos-varios.routes"));
app.use("/api/nomina", nominaRoutes);

// FRONT
app.use(express.static(path.resolve(__dirname, "../public")));
app.get("/", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../public/index.html"));
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// START
app.listen(PORT, () => {
  console.log(`OK http://localhost:${PORT}`);
});
