const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Please enter your event product name!"],
  },
  rate: {
    type: Number,
  },

  amount: {
    type: Number,
    required: [true, "Please enter the designated amount!"],
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
});

module.exports = mongoose.model("Commission", eventSchema);
