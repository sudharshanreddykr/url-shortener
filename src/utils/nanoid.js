const crypto = require("crypto");

const ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const SHORT_CODE_LENGTH = 7;

const generateShortCode = () => {
  const randomBytes = crypto.randomBytes(SHORT_CODE_LENGTH);
  let shortCode = "";

  for (let index = 0; index < SHORT_CODE_LENGTH; index += 1) {
    shortCode += ALPHABET[randomBytes[index] % ALPHABET.length];
  }

  return shortCode;
};

module.exports = { generateShortCode };

// calculation of 62^7 = 3,521,614,606,208 / 3.5 trillion possible combinations, which is sufficient for a URL shortener service.
