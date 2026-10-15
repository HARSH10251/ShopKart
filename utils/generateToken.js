const jwt = require("jsonwebtoken");

const generateTokenAndSetCookie = (res, customerId) => {
  const token = jwt.sign({ id: customerId }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });// web token banake deta hai

  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 1000, 
  });

  return token;
};

module.exports = generateTokenAndSetCookie;