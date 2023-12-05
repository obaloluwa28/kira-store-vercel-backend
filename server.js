const app = require("./api/app");
const connectDatabase = require("./db/Database");
const cloudinary = require("cloudinary");
require("dotenv").config();

const port = process.env.PORT || 4000

// Handling uncaught Exception
process.on("uncaughtException", (err) => {
  console.log(`Error: ${err.message}`);
});

// config
if (process.env.NODE_ENV !== "PRODUCTION") {
  require("dotenv").config({
    path: "config/.env",
  });
}

// connect db
connectDatabase();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})


// create server
const server = app.listen(port, () => {
  console.log(
    `Server is running on https://kirastores.com:${port}`
  );
});

// unhandled promise rejection
process.on("unhandledRejection", (err) => {
  console.log(`Shutting down the server for ${err.message}`);
  server.close(() => {
    process.exit(1);
  });
});
