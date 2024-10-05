const express = require("express");
const ErrorHandler = require("../middleware/error");
const app = express();
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const cors = require("cors");

const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:3002",
    "https://kirastores.com",
    "http://kirastores.com",
    "https://kirasurf.com",
    "http://kirasurf.com",
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type"],
  credentials: true,
};

// Use CORS middleware
app.use(cors(corsOptions));

// Handle OPTIONS requests (preflight)
// app.options("*", cors(corsOptions));

app.use(cookieParser());
app.use("/", express.static("uploads"));

app.use(express.json({ limit: "500mb" }));
app.use(
  express.urlencoded({
    limit: "500mb",
    parameterLimit: 100000000,
    extended: true,
  })
);

// config
if (process.env.NODE_ENV !== "PRODUCTION") {
  require("dotenv").config({
    path: "config/.env",
  });
}

// import routes
const user = require("../controller/user");
const shop = require("../controller/shop");
const product = require("../controller/product");
const event = require("../controller/event");
const coupon = require("../controller/coupounCode");
const payment = require("../controller/payment");
const order = require("../controller/order");
const conversation = require("../controller/conversation");
const message = require("../controller/message");
const withdraw = require("../controller/withdraw");
const category = require("../controller/categoryController");
const upload = require("../controller/uploadfile");

app.use("/api/v2/user", user);
app.use("/api/v2/conversation", conversation);
app.use("/api/v2/message", message);
app.use("/api/v2/order", order);
app.use("/api/v2/shop", shop);
app.use("/api/v2/product", product);
app.use("/api/v2/event", event);
app.use("/api/v2/coupon", coupon);
app.use("/api/v2/payment", payment);
app.use("/api/v2/withdraw", withdraw);
app.use("/api/v2/category", category);
app.use("/api/v2/upload", upload);

// it's for ErrorHandling
app.use(ErrorHandler);

module.exports = app;
a;
