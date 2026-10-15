const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const dns = require("dns");
const path = require("path");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });

console.log("--------------------------------------------------");
console.log("🚀 Server Environment Check:");
console.log("🔑 PORT:", process.env.PORT);
console.log("🔑 RAZORPAY_KEY_ID:", process.env.RAZORPAY_KEY_ID);
console.log("--------------------------------------------------");

if (!process.env.VERCEL) {
  try {
    dns.setDefaultResultOrder("ipv4first");
    dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
  } catch (e) {
    // Ignore if not supported in environment
  }
}

const customerRoutes = require("./routes/customer.routes");
const productRoutes = require("./routes/product.routes");
const wishlistRoutes = require("./routes/wishlist.routes");
const cartRoutes = require("./routes/cart.routes");
const orderRoutes = require("./routes/order.routes");

const app = express();

// Flexible CORS: allow localhost, vercel deployments, and custom CLIENT_URL
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app")
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/shopkart";

// Cached connection for Serverless / Cloud environments
let cachedConnection = null;
const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (!cachedConnection) {
    cachedConnection = mongoose
      .connect(MONGO_URI, {
        serverSelectionTimeoutMS: 8000,
      })
      .then((m) => m)
      .catch((err) => {
        cachedConnection = null; // Reset cache so subsequent requests can retry
        throw err;
      });
  }
  return await cachedConnection;
};

// Health check endpoint (always accessible without DB dependency)
const healthHandler = (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "ShopKart API is healthy and operational",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
};
app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

// CRITICAL: Middleware to ensure DB is connected BEFORE any API routes execute
app.use(async (req, res, next) => {
  if (req.path === "/health" || req.path === "/api/health") {
    return next();
  }
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("MongoDB Connection Middleware Error:", err);
    res.status(500).json({
      success: false,
      message: `Database connection error: ${err.message}. Please verify MONGO_URI and Atlas Network Access.`,
    });
  }
});

// Register routes at both root and /api prefixes AFTER DB connection middleware
const registerAppRoutes = (prefix = "") => {
  app.use(`${prefix}/customers`, customerRoutes);
  app.use(`${prefix}/products`, productRoutes);
  app.use(`${prefix}/wishlist`, wishlistRoutes);
  app.use(`${prefix}/cart`, cartRoutes);
  app.use(`${prefix}/orders`, orderRoutes);
};
registerAppRoutes("");
registerAppRoutes("/api");

// Start persistent server when running directly (local or Render/Railway)
if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  connectDB()
    .then(() => {
      console.log("Connected to MongoDB successfully");
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((err) => console.error("MongoDB Initial Connection Error:", err));
}

module.exports = app;