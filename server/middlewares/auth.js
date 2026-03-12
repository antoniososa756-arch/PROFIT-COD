const jwt = require("jsonwebtoken");
module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log("🧩 AUTH HEADER:", authHeader);
  if (!authHeader) {
    console.log("❌ NO AUTH HEADER");
    return res.status(401).json({ error: "NO_AUTH_HEADER" });
  }
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  console.log("🧩 TOKEN:", token);
  if (!token) {
    console.log("❌ TOKEN VACÍO");
    return res.status(401).json({ error: "TOKEN_VACIO" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ TOKEN DECODIFICADO:", decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.log("❌ JWT ERROR:", err.message);
    return res.status(401).json({ error: "JWT_INVALIDO" });
  }
};