const express = require("express");
const { isSeller, isAuthenticated, isAdmin } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const router = express.Router();
const Product = require("../model/product");
const Order = require("../model/order");
const Shop = require("../model/shop");
const cloudinary = require("cloudinary");
const ErrorHandler = require("../utils/ErrorHandler");
const apikeys = require("../config/apikey.json");
const multer = require("multer");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

// cloudinary.config({
//   cloud_name: "dswna4lpk",
//   api_key: "131168243967247",
//   api_secret: "mHFWI-Lw6oYk4wIueQ6wAh18GcU",
// });

// const opts = {
//   overwrite: true,
//   invalidate: true,
//   resource_type: "auto",
// };

// const uploadImage = (image) => {
//   //imgage = > base64
//   return new Promise((resolve, reject) => {
//     cloudinary.uploader.upload(
//       image,
//       opts,
//       (error, result) => {
//         if (result && result.secure_url) {
//           return resolve(result.secure_url);
//         }
//         return reject({ message: error.message });
//       },
//       {
//         folder: "kira_store",
//         use_filename: true,
//       }
//     );
//   });
// };

// module.exports = (image) => {
//   //imgage = > base64
//   return new Promise((resolve, reject) => {
//     cloudinary.uploader.upload(
//       image,
//       opts,
//       (error, result) => {
//         if (result && result.secure_url) {
//           return resolve(result.secure_url, result.public_id);
//         }
//         return reject({ message: error.message });
//       },
//       {
//         folder: "kira_store",
//         use_filename: true,
//       }
//     );
//   });
// };

// module.exports.uploadMultipleImages = (images) => {
//   return new Promise((resolve, reject) => {
//     const uploads = images.map((base) => uploadImage(base));
//     Promise.all(uploads)
//       .then((values) => resolve(values))
//       .catch((err) => reject(err));
//   });
// };

// Ensure the 'kirasurf' folder exists

const uploadDir = path.join(__dirname, "kirasurf");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure multer to save files in 'kirasurf' folder
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

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
      name: originalname, // Use the original file name
      parents: ["1MZ00DrpWUnvrSGPDs49DIIZyT0lNaAtW"], // Replace with your Google Drive folder ID - Kirasurf
    };

    drive.files.create(
      {
        resource: fileMetaData,
        media: {
          body: fs.createReadStream(filePath), // file that will get uploaded
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

// // create product

// router.post(
//   "/create-product",
//   catchAsyncErrors(async (req, res, next) => {
//     try {
//       const shopId = req.body.shopId;
//       const shop = await Shop.findById(shopId);
//       if (!shop) {
//         return next(new ErrorHandler("Shop Id is invalid!", 400));
//       } else {
//         let images = [];

//         if (typeof req.body.images === "string") {
//           images.push(req.body.images); // if it's a single image
//         } else {
//           images = req.body.images; // if images are more than
//         }

//         const imagesLinks = [];

//         for (let i = 0; i < images.length; i++) {
//           const result = await cloudinary.v2.uploader.upload(images[i], {
//             folder: "products",
//           });

//           imagesLinks.push({
//             public_id: result.public_id,
//             url: result.secure_url,
//           });
//         }

//         const productData = req.body;
//         productData.images = imagesLinks;
//         productData.shop = shop;

//         const product = await Product.create(productData);

//         res.status(201).json({
//           success: true,
//           product,
//         });
//       }
//     } catch (error) {
//       return next(new ErrorHandler(error, 400));
//     }
//   })
// );

// get all products of a shop

router.post(
  "/create-product",
  upload.array("images", 10), // Adjust the number of files as needed
  catchAsyncErrors(async (req, res, next) => {
    try {
      const shopId = req.body.shopId;
      // console.log(req.files);
      const shop = await Shop.findById(shopId);
      if (!shop) {
        return next(new ErrorHandler("Shop Id is invalid!", 400));
      }

      const images = req.files; // Access the uploaded files
      if (!images || images.length === 0) {
        return next(new ErrorHandler("No images provided", 400));
      }

      const imagesLinks = [];

      for (const file of images) {
        const filePath = path.join(uploadDir, file.filename);
        const fileName = file.originalname;
        const mimeType = file.mimetype;
        const authClient = await authorize();
        const result = await uploadFile(
          authClient,
          filePath,
          fileName,
          mimeType
        );

        const fileId = result.data.id;
        await google
          .drive({ version: "v3", auth: await authorize() })
          .permissions.create({
            fileId: fileId,
            requestBody: {
              role: "reader",
              type: "anyone",
            },
          });

        const fileUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
        imagesLinks.push({
          public_id: fileId,
          url: fileUrl,
        });

        // Clean up the uploaded file from local storage
        fs.unlinkSync(filePath);
      }

      const productData = req.body;
      productData.images = imagesLinks;
      productData.shop = shop;

      const product = await Product.create(productData);

      res.status(201).json({
        success: true,
        product,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  })
);

// Get product by ID
router.get(
  "/get-all-products-shop/:id",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const products = await Product.find({ shopId: req.params.id });

      res.status(201).json({
        success: true,
        products,
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

// Update product by ID
router.put(
  "/update-product/:id",
  upload.array("images", 10), // Adjust the number of files as needed
  catchAsyncErrors(async (req, res, next) => {
    try {
      const productId = req.params.id;
      const product = await Product.findById(productId);

      if (!product) {
        return next(new ErrorHandler("Product not found", 404));
      }

      const {
        name,
        description,
        category,
        tags,
        originalPrice,
        discountPrice,
        stock,
      } = req.body;

      // Update product fields if they are provided in the request body
      if (name) product.name = name;
      if (description) product.description = description;
      if (category) product.category = category;
      if (tags) product.tags = tags;
      if (originalPrice) product.originalPrice = originalPrice;
      if (discountPrice) product.discountPrice = discountPrice;
      if (stock) product.stock = stock;

      const images = req.files; // Access the uploaded files
      if (images && images.length > 0) {
        const imagesLinks = [];

        // Process new images
        for (const file of images) {
          const filePath = path.join(uploadDir, file.filename);
          const fileName = file.originalname;
          const mimeType = file.mimetype;

          const authClient = await authorize();
          const result = await uploadFile(
            authClient,
            filePath,
            fileName,
            mimeType
          );

          const fileId = result.data.id;
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
          imagesLinks.push({
            public_id: fileId,
            url: fileUrl,
          });

          // Clean up the uploaded file from local storage
          fs.unlinkSync(filePath);
        }

        // Update product images with the new links
        product.images = imagesLinks;
      }

      // Save the updated product
      await product.save();

      res.status(200).json({
        success: true,
        message: "Product updated successfully",
        product,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  })
);

// delete product of a shop
router.delete(
  "/delete-shop-product/:id",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const product = await Product.findByIdAndDelete(req.params.id);

      if (!product) {
        return next(new ErrorHandler("Product is not found with this id", 404));
      }

      for (let i = 0; 1 < product.images.length; i++) {
        const result = await cloudinary.v2.uploader.destroy(
          product.images[i].public_id
        );
      }

      await product.remove();

      res.status(201).json({
        success: true,
        message: "Product Deleted successfully!",
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

// get all products
router.get(
  "/get-all-products",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const category = req.query.category;
      let products;
      if (category) {
        products = await Product.find({ category }).sort({ createdAt: -1 });
      } else {
        products = await Product.find().sort({ createdAt: -1 });
      }

      res.status(201).json({
        success: true,
        products,
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

// review for a product
router.put(
  "/create-new-review",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { user, rating, comment, productId, orderId } = req.body;

      const product = await Product.findById(productId);

      const review = {
        user,
        rating,
        comment,
        productId,
      };

      const isReviewed = product.reviews.find(
        (rev) => rev.user._id === req.user._id
      );

      if (isReviewed) {
        product.reviews.forEach((rev) => {
          if (rev.user._id === req.user._id) {
            (rev.rating = rating), (rev.comment = comment), (rev.user = user);
          }
        });
      } else {
        product.reviews.push(review);
      }

      let avg = 0;

      product.reviews.forEach((rev) => {
        avg += rev.rating;
      });

      product.ratings = avg / product.reviews.length;

      await product.save({ validateBeforeSave: false });

      await Order.findByIdAndUpdate(
        orderId,
        { $set: { "cart.$[elem].isReviewed": true } },
        { arrayFilters: [{ "elem._id": productId }], new: true }
      );

      res.status(200).json({
        success: true,
        message: "Reviwed succesfully!",
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

// all products --- for admin
router.get(
  "/admin-all-products",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const products = await Product.find().sort({
        createdAt: -1,
      });
      res.status(201).json({
        success: true,
        products,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// Fetch unique product categories --- for admin -- ecommerce
router.get(
  "/categories",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 0; // Default limit to 0 (no limit) if not provided
      const categories = await Product.distinct("category");

      // If limit is specified and greater than 0, limit the number of categories
      const limitedCategories =
        limit > 0 ? categories.slice(0, limit) : categories;

      res.status(200).json({
        success: true,
        categories: limitedCategories,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// Fetch products by category with an optional limit --- for admin -- ecommerce
router.get(
  "/categories/:category",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const category = req.params.category;
      const limit = parseInt(req.query.limit, 10) || 0; // Default limit to 0 (no limit) if not provided

      const products = await Product.find({ category }).limit(limit);

      if (!products.length) {
        return next(
          new ErrorHandler("No products found in this category", 404)
        );
      }
      res.status(200).json({
        success: true,
        products,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// Fetch product by id --- for admin -- ecommerce
router.get(
  "/:id",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) {
        return next(new ErrorHandler("Product not found", 404));
      }
      res.status(200).json({
        success: true,
        product,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// all products --- for admin -- ecommerce
router.get(
  "/",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 0; // Default limit to 0 (no limit) if not provided

      const products = await Product.find()
        .sort({
          createdAt: -1,
        })
        .limit(limit);

      res.status(201).json({
        success: true,
        products,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

module.exports = router;
