const mongoose = require("mongoose");

const AttachmentSchema = new mongoose.Schema(
  {
    filename: String,
    path: String,
  },
  { _id: false }
);

const EmailLogSchema = new mongoose.Schema(
  {
    toEmail: { type: String, required: true },
    subject: { type: String, required: true },
    htmlPreview: { type: String },
    attachments: { type: [AttachmentSchema], default: [] },
    status: { type: String, enum: ["SENT", "FAILED"], required: true },
    error: { type: String },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

module.exports = mongoose.model("EmailLog", EmailLogSchema);
