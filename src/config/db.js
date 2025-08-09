const mongoose = require("mongoose");

async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    autoIndex: true,
  });
  console.log("MongoDB connected");
}

module.exports = { connectToDatabase };
