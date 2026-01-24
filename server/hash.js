const bcrypt = require("bcrypt");

(async () => {
  const hash = await bcrypt.hash("Sosa756**", 12);
  console.log(hash);
})();
