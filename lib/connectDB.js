// const mongoose = require('mongoose');

// const MONGODB_URI = process.env.MONGODB_URI;

// if (!MONGODB_URI) {
//   throw new Error('Please define MONGODB_URI environment variable');
// }

// // Cache connection across serverless invocations
// let cached = global._mongooseCache;
// if (!cached) {
//   cached = global._mongooseCache = { conn: null, promise: null };
// }

// async function connectDB() {
//   if (cached.conn) return cached.conn;

//   if (!cached.promise) {
//     cached.promise = mongoose.connect(MONGODB_URI, {
//       bufferCommands: false,
//       serverSelectionTimeoutMS: 10000,
//     });
//   }

//   cached.conn = await cached.promise;
//   return cached.conn;
// }

// module.exports = connectDB;

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI environment variable');
}

// Cache connection across serverless invocations
let cached = global._mongooseCache;

if (!cached) {
  cached = global._mongooseCache = {
    conn: null,
    promise: null,
  };
}

async function connectDB() {
  // Already connected
  if (cached.conn) {
    console.log('✅ Using existing MongoDB connection');
    return cached.conn;
  }

  // Create new connection
  if (!cached.promise) {
    console.log('⏳ Connecting to MongoDB...');

    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
    });
  }

  try {
    cached.conn = await cached.promise;

    console.log('✅ MongoDB connected successfully');
    console.log(`📦 Database: ${cached.conn.connection.name}`);
    console.log(`🌍 Host: ${cached.conn.connection.host}`);

    return cached.conn;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);

    cached.promise = null;
    throw error;
  }
}

module.exports = connectDB;