// models/Category.js
const mongoose = require("mongoose");

// Define the Category Schema
const CategorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    subTitle: {
      type: String,
      trim: true,
    },
    image_Url: {
      type: String,
      trim: true,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Static method to drop and recreate the unique index on 'title'
CategorySchema.statics.recreateIndex = async function () {
  try {
    await this.collection.dropIndex("title_1"); // Drop the existing index on title if it exists
  } catch (error) {
    if (error.code !== 27) {
      // 27 = "index not found"
      throw error; // Only throw if it's not a "not found" error
    }
  }
  await this.createIndexes(); // Recreate indexes based on the schema definition
};

// Compile the model
const Category = mongoose.model("Category", CategorySchema);

// Export the model
module.exports = Category;
