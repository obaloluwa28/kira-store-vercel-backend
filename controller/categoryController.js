const express = require("express");
const multer = require("multer");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAdmin } = require("../middleware/auth");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

const apikeys = require("../config/apikey.json");
const Category = require("../model/category");
// const category = require("../model/category");

const SCOPE = ["https://www.googleapis.com/auth/drive"];

async function authorize() {
  const jwtClient = new google.auth.JWT(
    apikeys.client_email,
    null,
    apikeys.private_key,
    SCOPE
  );

  await jwtClient.authorize();

  return jwtClient;
}

async function uploadFile(authClient, filePath, originalname, mimeType) {
  return new Promise((resolve, reject) => {
    const drive = google.drive({ version: "v3", auth: authClient });

    const fileMetaData = {
      name: originalname,
      parents: ["1d21t4rLZJITFcAC2onVaOqtA2fB10Poj"], // Replace with your Google Drive folder ID
    };

    drive.files.create(
      {
        resource: fileMetaData,
        media: {
          body: fs.createReadStream(filePath),
          mimeType: mimeType,
        },
        fields: "id",
      },
      function (error, file) {
        if (error) {
          return reject(error);
        }
        resolve(file);
      }
    );
  });
}

router.post(
  "/create",
  upload.single("image_Url"),
  catchAsyncErrors(async (req, res, next) => {
    const { title, subTitle } = req.body;

    // Check if category already exists
    let category = await Category.findOne({ title });
    if (category) {
      return next(new ErrorHandler("Category already exists", 400));
    }

    if (!req.file) {
      return next(new ErrorHandler("No image file provided", 400));
    }

    const filePath = req.file.path;

    try {
      const authClient = await authorize();
      const response = await uploadFile(
        authClient,
        filePath,
        req.file.originalname,
        req.file.mimetype
      );

      const fileId = response.data.id;

      await google
        .drive({ version: "v3", auth: authClient })
        .permissions.create({
          fileId: fileId,
          requestBody: {
            role: "reader",
            type: "anyone",
          },
        });

      const fileUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;

      // Create a new category
      category = new Category({
        title,
        subTitle,
        image_Url: fileUrl,
      });

      await category.save();

      // Fetch all categories in the db
      const categories = await Category.find();

      res.status(201).json({
        success: true,
        data: categories,
        message: "Category added successfully!",
      });
    } catch (error) {
      console.log(error.message);

      // Recreate indexes if the error is related to duplicate keys
      if (error.code === 11000) {
        await Category.recreateIndex();
      }

      return next(new ErrorHandler(error.message, 500));
    } finally {
      // Clean up the file in the uploads folder
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error("Error deleting file:", err.message);
      }
    }
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

async function deleteFile(authClient, fileId) {
  return new Promise((resolve, reject) => {
    const drive = google.drive({ version: "v3", auth: authClient });

    drive.files.delete({ fileId: fileId }, function (error, response) {
      if (error) {
        return reject(error);
      }
      resolve(response);
    });
  });
}

// Edit an existing category
router.put(
  "/edit/:id",
  upload.single("image_Url"),
  catchAsyncErrors(async (req, res, next) => {
    const { title, subTitle } = req.body;
    const { id } = req.params;

    // Find the existing category
    let category = await Category.findById(id);
    if (!category) {
      return next(new ErrorHandler("Category not found", 404));
    }

    const authClient = await authorize();

    // If there's a new image, handle the image replacement
    if (req.file) {
      // Extract fileId from the existing image URL
      const currentImageId = category.image_Url.split("id=")[1].split("&")[0];

      // Delete the current image from Google Drive
      await deleteFile(authClient, currentImageId);

      // Upload the new image to Google Drive
      const filePath = path.join(uploadDir, req.file.filename);
      const response = await uploadFile(
        authClient,
        filePath,
        req.file.originalname,
        req.file.mimetype
      );

      const fileId = response.data.id;
      await google
        .drive({ version: "v3", auth: authClient })
        .permissions.create({
          fileId: fileId,
          requestBody: {
            role: "reader",
            type: "anyone",
          },
        });

      const imageUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;

      // Update the category with the new image URL
      category.image_Url = imageUrl;

      // Clean up the file in the uploads folder
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error("Error deleting file:", err.message);
      }
    }

    // Update the category fields
    category.title = title;
    category.subTitle = subTitle;

    await category.save();

    res.status(200).json({
      success: true,
      data: category,
      message: "Category updated successfully!",
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
