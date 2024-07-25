const express = require("express");
const multer = require("multer");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const apikeys = require("../config/apikey.json");

const app = express();
const router = express.Router();

// Ensure the 'kirasurf' folder exists
const uploadDir = path.join(__dirname, "kirasurf");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure multer to save files in 'kirasurf' folder
const upload = multer({ dest: uploadDir });

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
      parents: ["1mwZGv0_3D0bLdXRWttvhIxSthoK31-Of"], // Replace with your Google Drive folder ID - Kirasurf
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

router.post("/", upload.single("file"), async (req, res) => {
  const filePath = path.join(uploadDir, req.file.filename); // Adjust the path to the uploaded file
  try {
    const authClient = await authorize();
    const response = await uploadFile(
      authClient,
      filePath,
      req.file.originalname,
      req.file.mimetype
    );

    const fileId = response.data.id;

    await google.drive({ version: "v3", auth: authClient }).permissions.create({
      fileId: fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    const fileUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;

    console.log("File uploaded successfully:", fileUrl);
    res.send({ fileUrl });
  } catch (error) {
    console.error("Error uploading file:", error.message);
    res.status(500).send(`Internal Server Error: ${error.message}`);
  } finally {
    // Clean up the file in the uploads folder
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error("Error deleting file:", err.message);
    }
  }
});

module.exports = router;
