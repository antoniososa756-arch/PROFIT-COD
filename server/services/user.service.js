const db = require("../db");
const bcrypt = require("bcryptjs");

function createUser({ email, password, role }) {
  return new Promise(async (resolve, reject) => {
    try {
      const hash = await bcrypt.hash(password, 10);

      db.run(
        `
        INSERT INTO users (email, password_hash, role)
        VALUES (?, ?, ?)
        `,
        [email, hash, role],
        function (err) {
          if (err) {
            if (err.message.includes("UNIQUE")) {
              return reject(new Error("EMAIL_EXISTS"));
            }
            return reject(err);
          }

          resolve({
            id: this.lastID,
            email,
            role,
          });
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { createUser };