const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const { errorHandler } = require("./middlewares/error.middleware.js");
const urlRoutes = require("./routes/url.routes.js");
const { redirect } = require("./controllers/url.controller.js");

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", urlRoutes);
app.use("/", urlRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

app.get("/:code", redirect);

app.use(errorHandler);

module.exports = app;
