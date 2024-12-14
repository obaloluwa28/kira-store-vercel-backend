const express = require("express");
const path = require("path");
const router = express.Router();
const jwt = require("jsonwebtoken");
const sendMail = require("../utils/sendMail");
const Shop = require("../model/shop");
const { isAuthenticated, isSeller, isAdmin } = require("../middleware/auth");
const cloudinary = require("cloudinary");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const sendShopToken = require("../utils/shopToken");
const bcrypt = require("bcryptjs");

// create activation token
const createActivationToken = (seller) => {
  return jwt.sign(seller, process.env.ACTIVATION_SECRET, {
    expiresIn: "10m",
  });
};

// create shop
router.post(
  "/create-shop",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { name, email, password, avatar, zipCode, address, phoneNumber } =
        req.body;

      // console.log("my body: ", req.body);
      const sellerEmail = await Shop.findOne({ email });
      if (sellerEmail) {
        return next(new ErrorHandler("User already exists", 400));
      }

      const seller = {
        name,
        email,
        password,
        avatar,
        address,
        phoneNumber,
        zipCode,
      };

      const activationToken = createActivationToken(seller);

      const activationUrl = `${process.env.APPURL}/seller/activation/${activationToken}`;

      try {
        const sellerEmailOptions = {
          email: seller.email,
          subject: "Activez le compte de votre boutique",
          html: `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
                  <h2 style="background-color: #4CAF50; color: white; padding: 15px; border-radius: 10px 10px 0 0; text-align: center; font-size: 24px;">
                    Activez votre compte boutique
                  </h2>
                  <p style="font-size: 14px; line-height: 1.5;">
                    Cher <strong>${seller.name}</strong>,
                  </p>
                  <p style="font-size: 14px; line-height: 1.5;">
                    Bienvenue dans les <strong>Kirasurf Stores</strong> ! Vous n'êtes qu'à une étape de l'activation du compte de votre boutique.
                  </p>
                  <p style="font-size: 14px; line-height: 1.5;">
                    Pour activer votre compte et commencer à vendre, veuillez cliquer sur le bouton ci-dessous:
                  </p>
                  <div style="text-align: center; margin: 20px 0;">
                    <a href="${activationUrl}" style="background-color: #4CAF50; color: white; text-decoration: none; padding: 10px 20px; font-size: 14px; border-radius: 5px; display: inline-block;">
                      Activer mon compte
                    </a>
                  </div>
                  <p style="font-size: 14px; line-height: 1.5;">
                    Veuillez noter que ce lien d'activation est valable pour les 5 prochaines minutes. Si le lien expire, vous devrez en demander un nouveau.
                  </p>
                  <p style="font-size: 14px; line-height: 1.5;">
                    Nous sommes ravis de vous compter à bord ! Si vous rencontrez des problèmes ou avez besoin d'aide supplémentaire, n'hésitez pas à contacter notre équipe d'assistance.
                  </p>
                  <p style="font-size: 14px; line-height: 1.5;">
                    Best regards,<br>
                    <strong>The Kirasurf Stores Team</strong>
                  </p>
                </div>
              `,
        };
        await sendMail(sellerEmailOptions);

        res.status(201).json({
          success: true,
          message: `please check your email:- ${seller.email} to activate your shop!`,
        });
      } catch (error) {
        return next(new ErrorHandler(error.message, 500));
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  })
);

// activate user
router.post(
  "/activation",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { activation_token } = req.body;

      const newSeller = jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET
      );

      if (!newSeller) {
        return next(new ErrorHandler("Invalid token", 400));
      }
      const { name, email, password, avatar, zipCode, address, phoneNumber } =
        newSeller;

      let seller = await Shop.findOne({ email });

      if (seller) {
        return next(new ErrorHandler("User already exists", 400));
      }

      seller = await Shop.create({
        name,
        email,
        avatar,
        password,
        zipCode,
        address,
        phoneNumber,
      });

      // console.log("seller: ", seller);

      sendShopToken(seller, 201, res);
    } catch (error) {
      // console.log("error: ", error.message);
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// Forgot password
router.post(
  "/reset-password",
  catchAsyncErrors(async (req, res, next) => {
    const { email } = req.body;
    try {
      const shop = await Shop.findOne({ email });

      if (!shop) {
        return res.status(404).json({ message: "Shop not found" });
      }

      const resetToken = jwt.sign(
        { id: shop._id },
        process.env.JWT_SECRET_KEY,
        {
          expiresIn: "15m",
        }
      );

      const resetUrl = `${process.env.APPURL}/shop-reset-password/${resetToken}`;

      const emailOptions = {
        email: shop.email,
        subject: "Demande de réinitialisation du mot de passe de la boutique",
        html: `
          <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.5;">
            <h2 style="color: #333;">Demande de réinitialisation du mot de passe</h2>
            <p style="margin-bottom: 20px;">
              Nous avons reçu une demande de réinitialisation du mot de passe de votre boutique. Cliquez sur le bouton ci-dessous pour le réinitialiser :
            </p>
            <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; font-size: 14px; color: #fff; background-color: #007bff; text-decoration: none; border-radius: 5px;">
              Reset Password
            </a>
            <p style="margin-top: 20px;">
              Si vous n'avez pas demandé de réinitialisation de mot de passe, veuillez ignorer cet e-mail. Ce lien expirera dans 15 minutes.
            </p>
            <p>
              Merci,<br/>
              Kirasurf Support Team
            </p>
          </div>
        `,
      };

      await sendMail(emailOptions);

      res
        .status(200)
        .json({ message: "Password reset link sent to your email" });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  })
);

// Reset password
router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const shop = await Shop.findById(decoded.id);

    if (!shop) {
      return res.status(400).json({ message: "Invalid token or user" });
    }

    shop.password = password;
    await shop.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// login shop
router.post(
  "/login-shop",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return next(new ErrorHandler("Please provide the all fields!", 400));
      }

      const user = await Shop.findOne({ email }).select("+password");

      if (!user) {
        return next(new ErrorHandler("User doesn't exists!", 400));
      }

      let validity = await bcrypt.compare(password, user.password);

      if (!validity) {
        return next(new ErrorHandler("Incorrect Username/Password", 400));
      }

      sendShopToken(user, 201, res);
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// load shop
router.get(
  "/getSeller",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const seller = await Shop.findById(req.seller._id);

      if (!seller) {
        return next(new ErrorHandler("User doesn't exists", 400));
      }

      res.status(200).json({
        success: true,
        seller,
      });
    } catch (error) {
      console.log(error);
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// log out from shop
router.get(
  "/logout",
  catchAsyncErrors(async (req, res, next) => {
    try {
      res.cookie("seller_token", null, {
        expires: new Date(Date.now()),
        httpOnly: true,
        sameSite: "none",
        secure: true,
      });
      res.status(201).json({
        success: true,
        message: "Log out successful!",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// get shop info
router.get(
  "/get-shop-info/:id",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const shop = await Shop.findById(req.params.id);
      res.status(201).json({
        success: true,
        shop,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// update shop profile picture
router.put(
  "/update-shop-avatar",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    try {
      let existsSeller = await Shop.findById(req.seller._id);

      const imageId = existsSeller.avatar.public_id;

      await cloudinary.v2.uploader.destroy(imageId);

      const myCloud = await cloudinary.v2.uploader.upload(req.body.avatar, {
        folder: "avatars",
        width: 150,
      });

      existsSeller.avatar = {
        public_id: myCloud.public_id,
        url: myCloud.secure_url,
      };

      await existsSeller.save();

      res.status(200).json({
        success: true,
        seller: existsSeller,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// update seller info
router.put(
  "/update-seller-info",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { name, description, address, phoneNumber, zipCode } = req.body;

      const shop = await Shop.findOne(req.seller._id);

      if (!shop) {
        return next(new ErrorHandler("User not found", 400));
      }

      shop.name = name;
      shop.description = description;
      shop.address = address;
      shop.phoneNumber = phoneNumber;
      shop.zipCode = zipCode;

      await shop.save();

      res.status(201).json({
        success: true,
        shop,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// all sellers --- for admin
router.get(
  "/admin-all-sellers",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const sellers = await Shop.find().sort({
        createdAt: -1,
      });
      res.status(201).json({
        success: true,
        sellers,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// delete seller ---admin
router.delete(
  "/delete-seller/:id",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const seller = await Shop.findByIdAndDelete(req.params.id);

      if (!seller) {
        return next(
          new ErrorHandler("Seller is not available with this id", 400)
        );
      }

      await Shop.findByIdAndDelete(req.params.id);
      const sellers = await Shop.find().sort({
        createdAt: -1,
      });

      res.status(201).json({
        success: true,
        sellers,
        message: "Seller deleted successfully!",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// update seller withdraw methods --- sellers
router.put(
  "/update-payment-methods",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { withdrawMethod } = req.body;

      const seller = await Shop.findByIdAndUpdate(req.seller._id, {
        withdrawMethod,
      });

      res.status(201).json({
        success: true,
        seller,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// delete seller withdraw merthods --- only seller
router.delete(
  "/delete-withdraw-method/",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const seller = await Shop.findByIdAndDelete(req.seller._id);

      if (!seller) {
        return next(new ErrorHandler("Seller not found with this id", 400));
      }

      seller.withdrawMethod = null;

      await seller.save();

      res.status(201).json({
        success: true,
        seller,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

module.exports = router;
