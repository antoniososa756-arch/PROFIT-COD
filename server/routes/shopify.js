const express = require("express");
const crypto = require("crypto");

const router = express.Router();

router.get("/connect", (req, res) => {
  const { shop } = req.query;

  if (!shop) {
    return res.status(400).send("Falta parámetro shop");
  }

  const state = crypto.randomBytes(16).toString("hex");

  const installUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${process.env.SHOPIFY_API_KEY}` +
    `&scope=${process.env.SHOPIFY_SCOPES}` +
    `&redirect_uri=${process.env.SHOPIFY_REDIRECT_URI}` +
    `&state=${state}`;

  res.redirect(installUrl);
});

module.exports = router;
