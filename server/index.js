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
// ⛔️ AÚN DESACTIVADAS
// const adminRoutes = require("./routes/admin.routes");
// const userRoutes = require("./routes/users");
// const metricsRoutes = require("./routes/metrics.routes");
// const ordersRoutes = require("./routes/orders.routes");

const shopifyWebhooks = require("./routes/shopify.webhooks");

const app = express();
const PORT = Number(process.env.PORT || 3001);

// ⚠️ IMPORTANTE: webhooks usan RAW body
app.use("/api/shopify/webhooks", shopifyWebhooks);

// Middlewares normales
app.use(cors());
app.use(express.json());

// Inyección global de DB
app.use((req, res, next) => {
  req.db = db;
  next();
});

// API (AUTH + SHOPIFY)
app.use("/api/auth", authRoutes);
app.use("/api/shopify", shopifyRoutes);

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
