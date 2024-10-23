// create token and saving that in cookies
const sendToken = (user, statusCode, res) => {
  const token = user.getJwtToken();

  // // Options for cookies
  // const options = {
  //   expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  //   httpOnly: true,
  //   sameSite: "none",
  //   secure: true,
  // };

  // Options for cookies
  const options = {
    expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    domain: ".kirasurf.com", // This allows subdomains to share the cookie
    path: "/",
    httpOnly: true, // Optional: Set this if you don't need to access the cookie via JavaScript
    secure: true, // Make sure this is true in production (requires HTTPS)
    sameSite: "Lax", // Adjust based on whether you're doing cross-site requests
  };

  res.status(statusCode).cookie("token", token, options).json({
    success: true,
    user,
    token,
  });
};

module.exports = sendToken;
