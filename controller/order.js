const express = require("express");
const router = express.Router();
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated, isSeller, isAdmin } = require("../middleware/auth");
const Order = require("../model/order");
const Shop = require("../model/shop");
const Product = require("../model/product");
const sendMail = require("../utils/sendMail"); // Import sendMail function

// create new order
router.post(
  "/create-order",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { cart, shippingAddress, user, totalPrice, paymentInfo } = req.body;

      // Group cart items by shopId
      const shopItemsMap = new Map();

      for (const item of cart) {
        const shopId = item.shopId;
        if (!shopItemsMap.has(shopId)) {
          shopItemsMap.set(shopId, []);
        }
        shopItemsMap.get(shopId).push(item);
      }

      // Create an order for each shop
      const orders = [];

      for (const [shopId, items] of shopItemsMap) {
        const order = await Order.create({
          cart: items,
          shippingAddress,
          user,
          totalPrice,
          paymentInfo,
        });
        orders.push(order);

        // Send email to buyer
        const buyerEmailOptions = {
          email: user.email,
          subject:
            "Commande passée avec succès - Merci d'avoir fait vos achats chez nous !",
          html: `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
              <h2 style="background-color: #4CAF50; color: white; padding: 15px; border-radius: 10px 10px 0 0; text-align: center; font-size: 24px;">
                Merci pour votre commande!
              </h2>
              <p style="font-size: 16px; line-height: 1.5;">
                Cher <strong>${user.name}</strong>,
              </p>
              <p style="font-size: 16px; line-height: 1.5;">
                Nous sommes ravis de vous informer que votre commande a été passée avec succès. Vous trouverez ci-dessous les détails des articles que vous avez commandés :
              </p>
              <ul style="font-size: 16px; line-height: 1.5; margin: 10px 0 20px; padding: 0; list-style-type: none;">
                ${items
                  .map(
                    (item) =>
                      `<li style="padding: 10px 0; border-bottom: 1px solid #eaeaea;">- <strong>${item.name}</strong></li>`
                  )
                  .join("")}
              </ul>
              <p style="font-size: 16px; line-height: 1.5;">
                Votre commande est en cours de traitement et sera expédiée sous peu. Vous recevrez une mise à jour avec les informations de suivi dès que votre colis sera en route.
              </p>
              <p style="font-size: 16px; line-height: 1.5;">
                Merci de nous avoir choisis ! Si vous avez des questions ou des préoccupations, n'hésitez pas à contacter notre équipe d'assistance.
              </p>
              <p style="font-size: 16px; line-height: 1.5;">
                Cordialement,<br>
                <strong>Équipe d'assistance Kirasurf</strong>
              </p>
            </div>
          `,
        };
        await sendMail(buyerEmailOptions);

        // Send email to seller
        const shop = await Shop.findById(shopId); // Assuming Shop model has a findById method

        const sellerEmailOptions = {
          email: shop.email,
          subject: "Nouvelle commande reçue – Action requise",
          html: `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
              <h2 style="background-color: #e50000; color: white; padding: 15px; border-radius: 10px 10px 0 0; text-align: center; font-size: 24px;">
                Notification de nouvelle commande
              </h2>
              <p style="font-size: 16px; line-height: 1.5;">
                Dear <strong>${shop.name}</strong>,
              </p>
              <p style="font-size: 16px; line-height: 1.5;">
                Vous avez reçu une nouvelle commande ! Voici le détail des articles achetés :
              </p>
              <ul style="font-size: 16px; line-height: 1.5; margin: 10px 0 20px; padding: 0; list-style-type: none;">
                ${items
                  .map(
                    (item) =>
                      `<li style="padding: 10px 0; border-bottom: 1px solid #eaeaea;">- <strong>${item.name}</strong></li>`
                  )
                  .join("")}
              </ul>
              <p style="font-size: 16px; line-height: 1.5;">
                Veuillez préparer ces articles pour l'expédition et marquer la commande comme traitée dans votre tableau de bord vendeur dès que possible.
              </p>
              <p style="font-size: 16px; line-height: 1.5;">
                Merci d'être un vendeur estimé avec nous. Si vous avez des questions, n'hésitez pas à contacter notre équipe d'assistance.
              </p>
              <p style="font-size: 16px; line-height: 1.5;">
                Cordialement,<br>
                <strong>Équipe d'assistance Kirasurf</strong>
              </p>
            </div>
          `,
        };
        await sendMail(sellerEmailOptions);
      }

      res.status(201).json({
        success: true,
        orders,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// // create new order
// router.post(
//   "/create-order",
//   catchAsyncErrors(async (req, res, next) => {
//     try {
//       const { cart, shippingAddress, user, totalPrice, paymentInfo } = req.body;

//       //   group cart items by shopId
//       const shopItemsMap = new Map();

//       for (const item of cart) {
//         const shopId = item.shopId;
//         if (!shopItemsMap.has(shopId)) {
//           shopItemsMap.set(shopId, []);
//         }
//         shopItemsMap.get(shopId).push(item);
//       }

//       // create an order for each shop
//       const orders = [];

//       for (const [shopId, items] of shopItemsMap) {
//         const order = await Order.create({
//           cart: items,
//           shippingAddress,
//           user,
//           totalPrice,
//           paymentInfo,
//         });
//         orders.push(order);
//       }

//       res.status(201).json({
//         success: true,
//         orders,
//       });
//     } catch (error) {
//       return next(new ErrorHandler(error.message, 500));
//     }
//   })
// );

// get all orders of user
router.get(
  "/get-all-orders/:userId",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const orders = await Order.find({ "user._id": req.params.userId }).sort({
        createdAt: -1,
      });

      res.status(200).json({
        success: true,
        orders,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// get all orders of seller
router.get(
  "/get-seller-all-orders/:shopId",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const orders = await Order.find({
        "cart.shopId": req.params.shopId,
      }).sort({
        createdAt: -1,
      });

      res.status(200).json({
        success: true,
        orders,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// update order status for seller
router.put(
  "/update-order-status/:id",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.id);

      if (!order) {
        return next(new ErrorHandler("Order not found with this id", 400));
      }
      if (req.body.status === "Transferred to delivery partner") {
        order.cart.forEach(async (o) => {
          await updateOrder(o._id, o.qty);
        });
      }

      order.status = req.body.status;

      if (req.body.status === "Delivered") {
        order.deliveredAt = Date.now();
        order.paymentInfo.status = "Succeeded";
        const serviceCharge = order.totalPrice * 0.1;
        await updateSellerInfo(order.totalPrice - serviceCharge);
      }

      await order.save({ validateBeforeSave: false });

      res.status(200).json({
        success: true,
        order,
      });

      async function updateOrder(id, qty) {
        const product = await Product.findById(id);

        product.stock -= qty;
        product.sold_out += qty;

        await product.save({ validateBeforeSave: false });
      }

      async function updateSellerInfo(amount) {
        const seller = await Shop.findById(req.seller.id);

        seller.availableBalance = amount;

        await seller.save();
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// give a refund ----- user
router.put(
  "/order-refund/:id",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.id);

      if (!order) {
        return next(new ErrorHandler("Order not found with this id", 400));
      }

      order.status = req.body.status;

      await order.save({ validateBeforeSave: false });

      res.status(200).json({
        success: true,
        order,
        message: "Order Refund Request successfully!",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// accept the refund ---- seller
router.put(
  "/order-refund-success/:id",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.id);

      if (!order) {
        return next(new ErrorHandler("Order not found with this id", 400));
      }

      order.status = req.body.status;

      await order.save();

      res.status(200).json({
        success: true,
        message: "Order Refund successfull!",
      });

      if (req.body.status === "Refund Success") {
        order.cart.forEach(async (o) => {
          await updateOrder(o._id, o.qty);
        });
      }

      async function updateOrder(id, qty) {
        const product = await Product.findById(id);

        product.stock += qty;
        product.sold_out -= qty;

        await product.save({ validateBeforeSave: false });
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// all orders --- for admin
router.get(
  "/admin-all-orders",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const orders = await Order.find().sort({
        deliveredAt: -1,
        createdAt: -1,
      });
      res.status(201).json({
        success: true,
        orders,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

module.exports = router;
