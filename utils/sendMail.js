const nodemailer = require("nodemailer");

const sendMail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMPT_HOST,
    port: process.env.SMPT_PORT,
    service: process.env.SMPT_SERVICE,
    auth: {
      user: process.env.SMPT_MAIL,
      pass: process.env.SMPT_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const mailOptions = {
    // from: process.env.SMPT_MAIL,
    from: {
      name: "KIRASURF LTD",
      address: process.env.SMPT_MAIL,
    },
    to: options.email,
    cc: ["oooduyemi@gmail.com", "ibkossy@gmail.com"],
    subject: options.subject,
    html: options.html,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendMail;
