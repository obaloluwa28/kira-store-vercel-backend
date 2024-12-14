const express = require("express");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const Commission = require("../model/commission");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAdmin, isAuthenticated } = require("../middleware/auth");
const router = express.Router();

// create Commission
router.post(
  "/admin-create",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { title, rate, amount } = req.body;

      console.log(req.body);

      // Validate required fields
      if (!title || !amount) {
        return next(new ErrorHandler("Title and amount are required", 400));
      }

      // Create a new commission document
      await Commission.create({
        title,
        rate,
        amount,
      });

      // Fetch all commissions, sorted by creation date
      const commissions = await Commission.find().sort({ createdAt: -1 });

      res.status(201).json({
        success: true,
        message: "Commission created successfully!",
        commissions,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  })
);

// get all commissions
router.get(
  "/get-all-commission",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const commissions = await Commission.find().sort({
        createdAt: -1,
      });

      res.status(201).json({
        success: true,
        commissions,
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

// delete commission
router.delete(
  "/delete-admin/:id",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const commission = await Commission.findByIdAndDelete(req.params.id);

      if (!commission) {
        return next(new ErrorHandler("Product is not found with this id", 404));
      }

      const commissions = await Commission.find().sort({ createdAt: -1 });

      res.status(201).json({
        success: true,
        commissions,
        message: "Event Deleted successfully!",
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

module.exports = router;
