require("dotenv").config({
  path: require("path").join(__dirname, ".env")
});

const express = require("express");
const path = require("path");
const cors = require("cors");

// DB
require("./db");

// Routes
const authRoutes = require("./routes/auth.routes");
const shopifyRoutes = require("./routes/shopify.routes");
const adminRoutes = require("./routes/admin.routes");
const userRoutes = require("./routes/users");
const metricsRoutes = require("./routes/metrics.routes");

const app = express();
const PORT = Number(process.env.PORT || 3001);

// Middlewares
app.use(cors());
app.use(express.json());

// API
app.use("/api/auth", authRoutes);
app.use("/api/shopify", shopifyRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/metrics", metricsRoutes);

// FRONT
app.use(express.static(path.resolve(__dirname, "../public")));
app.get("/", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../public/index.html"));
});

// 404 SIEMPRE AL FINAL
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// LISTEN (AQUÍ ARRANCA EL SERVER)
app.listen(PORT, () => {
  console.log(`OK http://localhost:${PORT}`);
});
