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
// Stripe webhook necesita raw body también
app.use("/api/billing/stripe/webhook", express.raw({ type: "application/json" }));

// Middlewares normales
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Inyección global de DB
app.use((req, res, next) => {
  req.db = db;
  next();
});

const auth      = require("./middlewares/auth");
const planCheck = require("./middlewares/planCheck");

// Rutas que NO requieren plan activo (auth, billing, admin, health)
app.use("/api/auth",    authRoutes);
app.use("/api/billing", require("./routes/billing.routes").router);
app.use("/api/admin",   adminRoutes);
app.use("/api/users",   userRoutes);
app.use("/api/health",  require("./routes/health.routes"));

// Shopify: connect y callback son redirects sin Auth header, se registran sin planCheck
app.use("/api/shopify", shopifyRoutes);

// Rutas de datos — requieren plan activo (clientes)
app.use("/api/metrics",      auth, planCheck, metricsRoutes);
app.use("/api/orders",       auth, planCheck, ordersRoutes);
app.use("/api/tracking",     auth, planCheck, require("./routes/tracking.routes"));
app.use("/api/ads",          auth, planCheck, require("./routes/ads.routes"));
app.use("/api/gastos-fijos", auth, planCheck, require("./routes/gastos-fijos.routes"));
app.use("/api/impuestos",    auth, planCheck, require("./routes/impuestos.routes"));
app.use("/api/gastos-varios",auth, planCheck, require("./routes/gastos-varios.routes"));
app.use("/api/nomina",       auth, planCheck, nominaRoutes);

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
  // Arrancar sincronización automática en background
  const { startCrons } = require("./cron");
  startCrons();
});
