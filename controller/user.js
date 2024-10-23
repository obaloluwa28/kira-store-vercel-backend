const express = require("express");
const User = require("../model/user");
const router = express.Router();
const cloudinary = require("cloudinary");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const jwt = require("jsonwebtoken");
const sendMail = require("../utils/sendMail");
const sendToken = require("../utils/jwtToken");
const { isAuthenticated, isAdmin } = require("../middleware/auth");
const bcrypt = require("bcryptjs");

// create activation token
const createActivationToken = (user) => {
  return jwt.sign(user, process.env.ACTIVATION_SECRET, {
    expiresIn: "10m",
  });
};

// create user
router.post("/create-user", async (req, res, next) => {
  try {
    const { name, email, password, avatar } = req.body;
    const userEmail = await User.findOne({ email });

    if (userEmail) {
      return next(new ErrorHandler("User already exists", 400));
    }

    const user = {
      name: name,
      email: email,
      password: password,
      avatar: avatar,
    };

    const activationToken = createActivationToken(user);

    const activationUrl = `${process.env.APPURL}/activation/${activationToken}`;

    try {
      const userEmailOptions = {
        email: user.email,
        subject: "Activate Your Account - Kirasurf",
        html: `<div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
            <h2 style="background-color: #1E90FF; color: white; padding: 15px; border-radius: 10px 10px 0 0; text-align: center; font-size: 24px;">
              Activate Your Account
            </h2>
            <p style="font-size: 14px; line-height: 1.5;">
              Dear <strong>${user.name}</strong>,
            </p>
            <p style="font-size: 14px; line-height: 1.5;">
              Welcome to <strong>Kirasurf</strong>! You're just a step away from getting started.
            </p>
            <p style="font-size: 14px; line-height: 1.5;">
              To activate your account and start enjoying our services, please click the button below:
            </p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${activationUrl}" style="background-color: #1E90FF; color: white; text-decoration: none; padding: 10px 20px; font-size: 14px; border-radius: 5px; display: inline-block;">
                Activate My Account
              </a>
            </div>
            <p style="font-size: 14px; line-height: 1.5;">
              Please note, this activation link is only valid for the next 5 minutes. If the link expires, you can request a new one from our platform.
            </p>
            <p style="font-size: 14px; line-height: 1.5;">
              We're excited to have you onboard! If you need assistance or have any questions, our support team is here to help.
            </p>
            <p style="font-size: 14px; line-height: 1.5;">
              Best regards,<br>
              <strong>Kirasurf Support Team</strong>
            </p>
          </div>`,
      };
      await sendMail(userEmailOptions);

      res.status(201).json({
        success: true,
        message: `please check your email:- ${user.email} to activate your account!`,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  } catch (error) {
    return next(new ErrorHandler(error.message, 400));
  }
});

// activate user
router.post(
  "/activation",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { activation_token } = req.body;

      // Verify activation token
      const newUser = jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET
      );

      if (!newUser) {
        return next(new ErrorHandler("Invalid token", 400));
      }

      const { name, email, password, avatar } = newUser;

      // Check if user already exists
      let user = await User.findOne({ email });
      if (user) {
        return next(new ErrorHandler("User already exists", 400));
      }

      // Create new user
      user = await User.create({
        name,
        email,
        avatar,
        password,
      });

      // Send token and response (only once)
      sendToken(user, 201, res); // Assuming sendToken already sends a response
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(400).json({ message: "Activation link expired." });
      } else {
        return res
          .status(500)
          .json({ message: "An error occurred during activation." });
      }
    }
  })
);

// Forgot password
router.post(
  "/reset-password",
  catchAsyncErrors(async (req, res, next) => {
    const { email } = req.body;
    try {
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const resetToken = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET_KEY,
        {
          expiresIn: "15m",
        }
      );

      const resetUrl = `${process.env.APPURL}/reset-password/${resetToken}`;

      const emailOptions = {
        email: user.email,
        subject: "Password Reset Request",
        html: `
          <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.5;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p style="margin-bottom: 20px;">
              We received a request to reset your password. Click the button below to reset it:
            </p>
            <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; font-size: 14px; color: #fff; background-color: #007bff; text-decoration: none; border-radius: 5px;">
              Reset Password
            </a>
            <p style="margin-top: 20px;">
              If you did not request a password reset, please ignore this email. This link will expire in 30 minutes.
            </p>
            <p>
              Thanks,<br/>
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
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(400).json({ message: "Invalid token or user" });
    }

    user.password = password;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// login user
router.post(
  "/login-user",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return next(new ErrorHandler("Please provide the all fields!", 400));
      }

      const user = await User.findOne({ email }).select("+password");

      if (!user) {
        return next(new ErrorHandler("User doesn't exists!", 400));
      }

      let validity = await bcrypt.compare(password, user.password);

      if (!validity) {
        return next(new ErrorHandler("Incorrect Username/Password", 400));
      }

      sendToken(user, 201, res);
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// load user
router.get(
  "/getuser",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);

      if (!user) {
        return next(new ErrorHandler("User doesn't exists", 400));
      }

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// log out user
router.get(
  "/logout",
  catchAsyncErrors(async (req, res, next) => {
    try {
      res.cookie("token", null, {
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

// update user info
router.put(
  "/update-user-info",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { email, password, phoneNumber, name } = req.body;

      const user = await User.findOne({ email }).select("+password");

      if (!user) {
        return next(new ErrorHandler("User not found", 400));
      }

      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        return next(
          new ErrorHandler("Please provide the correct information", 400)
        );
      }

      user.name = name;
      user.email = email;
      user.phoneNumber = phoneNumber;

      await user.save();

      res.status(201).json({
        success: true,
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// update user avatar
router.put(
  "/update-avatar",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      let existsUser = await User.findById(req.user.id);
      if (req.body.avatar !== "") {
        const imageId = existsUser.avatar.public_id;

        await cloudinary.v2.uploader.destroy(imageId);

        const myCloud = await cloudinary.v2.uploader.upload(req.body.avatar, {
          folder: "avatars",
          width: 150,
        });

        existsUser.avatar = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      }

      await existsUser.save();

      res.status(200).json({
        success: true,
        user: existsUser,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// update user addresses
router.put(
  "/update-user-addresses",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);

      const sameTypeAddress = user.addresses.find(
        (address) => address.addressType === req.body.addressType
      );
      if (sameTypeAddress) {
        return next(
          new ErrorHandler(`${req.body.addressType} address already exists`)
        );
      }

      const existsAddress = user.addresses.find(
        (address) => address._id === req.body._id
      );

      if (existsAddress) {
        Object.assign(existsAddress, req.body);
      } else {
        // add the new address to the array
        user.addresses.push(req.body);
      }

      await user.save();

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// delete user address
router.delete(
  "/delete-user-address/:id",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const userId = req.user._id;
      const addressId = req.params.id;

      await User.updateOne(
        {
          _id: userId,
        },
        { $pull: { addresses: { _id: addressId } } }
      );

      const user = await User.findByIdAndDelete(userId);

      res.status(200).json({ success: true, user });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// update user password
router.put(
  "/update-user-password",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id).select("+password");

      const isPasswordMatched = await user.comparePassword(
        req.body.oldPassword
      );

      if (!isPasswordMatched) {
        return next(new ErrorHandler("Old password is incorrect!", 400));
      }

      if (req.body.newPassword !== req.body.confirmPassword) {
        return next(
          new ErrorHandler("Password doesn't matched with each other!", 400)
        );
      }
      user.password = req.body.newPassword;

      await user.save();

      res.status(200).json({
        success: true,
        message: "Password updated successfully!",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// find user infoormation with the userId
router.get(
  "/user-info/:id",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);

      res.status(201).json({
        success: true,
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// all users --- for admin
router.get(
  "/admin-all-users",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const users = await User.find().sort({
        createdAt: -1,
      });

      res.status(201).json({
        success: true,
        users,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// delete users --- admin
router.delete(
  "/delete-user/:id",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const user = await User.findByIdAndDelete(req.params.id);

      if (!user) {
        return next(
          new ErrorHandler("User is not available with this id", 400)
        );
      }

      const imageId = user.avatar.public_id;

      await cloudinary.v2.uploader.destroy(imageId);

      await User.findByIdAndDelete(req.params.id);

      res.status(201).json({
        success: true,
        message: "User deleted successfully!",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

module.exports = router;
