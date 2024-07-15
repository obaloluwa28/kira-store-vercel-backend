// controllers/categoryController.js
const express = require("express");
const Category = require("../model/category");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAdmin } = require("../middleware/auth");
const router = express.Router();

// Create a new category
router.post(
  "/create",
  catchAsyncErrors(async (req, res, next) => {
    const { name, description } = req.body;

    // Check if category already exists
    let category = await Category.findOne({ name });
    if (category) {
      return next(new ErrorHandler("Category already exists", 400));
    }

    // Create a new category
    category = new Category({
      name,
      description,
    });

    await category.save();

    // Fetch all categories in the db
    const categories = await Category.find();

    res.status(201).json({
      success: true,
      data: categories,
      message: "Category added successfully!",
    });
  })
);

// Delete category
router.delete(
  "/delete/:id",
  // isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) {
      return next(new ErrorHandler("Category not found with this id", 404));
    }

    // Fetch all categories in the db
    const categories = await Category.find();

    res.status(200).json({
      success: true,
      data: categories,
      message: "Category removed successfully!",
    });
  })
);

// Get all categories
router.get(
  "/",
  catchAsyncErrors(async (req, res, next) => {
    const categories = await Category.find();

    res.status(200).json({
      success: true,
      categories,
    });
  })
);

module.exports = router;
