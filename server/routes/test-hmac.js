const express = require("express");
const crypto = require("crypto");

const router = express.Router();

router.post(
  "/test-hmac",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const body = req.body;

    const apiSecret = process.env.TEST_API_SECRET; // aquí ponemos lo que queramos
    const hmacHeader = req.headers["x-test-hmac"];

    const generated = crypto
      .createHmac("sha256", apiSecret)
      .update(body)
      .digest("base64");

    res.json({
      receivedHmac: hmacHeader,
      generatedHmac: generated,
      match: hmacHeader === generated,
    });
  }
);

module.exports = router;
