require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
// const morgan = require("morgan");
const multer = require("multer");
const nodemailer = require("nodemailer");
const ejs = require("ejs");

const { connectToDatabase } = require("./config/db");
const EmailLog = require("./models/EmailLog");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

// middlewares

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// app.use(morgan("dev"));
app.use("/public", express.static(path.join(__dirname, "..", "public")));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || "false") === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  logger: String(process.env.SMTP_DEBUG || "false") === "true",
  debug: String(process.env.SMTP_DEBUG || "false") === "true",
  tls: { minVersion: "TLSv1.2" },
});

transporter
  .verify()
  .then(() => {
    console.log("SMTP connection verified and ready to send.");
  })
  .catch((err) => {
    console.error("SMTP verify failed:", err);
  });

app.get("/", (_req, res) => {
  res.render("index", { sent: null, error: null });
});

app.get("/history", async (_req, res) => {
  const logs = await EmailLog.find().sort({ _id: -1 }).limit(200).lean();
  res.render("history", { logs });
});

app.get("/history/:id", async (req, res) => {
  const log = await EmailLog.findById(req.params.id).lean();
  if (!log) return res.status(404).send("Not found");
  res.render("history-detail", { log, attachments: log.attachments || [] });
});

app.post("/send", upload.array("attachments", 5), async (req, res) => {
  const { to, subject, message, name } = req.body;
  if (!to || !subject) {
    return res.status(400).render("index", {
      sent: null,
      error: 'Fields "to" and "subject" are required.',
    });
  }

  const templatePath = path.join(
    __dirname,
    "..",
    "views",
    "email-template.ejs"
  );
  const html = await ejs.renderFile(templatePath, {
    name: name || "there",
    message: message || "",
  });

  const attachments = (req.files || []).map((file) => ({
    filename: file.originalname,
    path: file.path,
  }));

  try {
    const info = await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to,
      subject,
      html,
      attachments,
    });

    await EmailLog.create({
      toEmail: to,
      subject,
      htmlPreview: html.slice(0, 500),
      attachments,
      status: "SENT",
      error: null,
    });

    res.render("index", { sent: `Email sent: ${info.messageId}`, error: null });
  } catch (err) {
    await EmailLog.create({
      toEmail: to,
      subject,
      htmlPreview: "",
      attachments,
      status: "FAILED",
      error: String(err && err.message ? err.message : err),
    });
    res.status(500).render("index", {
      sent: null,
      error: "Failed to send email. Check SMTP credentials and logs.",
    });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).send("Server error");
});

const port = Number(process.env.PORT || 3000);
connectToDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
