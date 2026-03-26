import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/rebalance'

/** Connect to MongoDB. Returns existing connection if already connected. */
export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose
  return mongoose.connect(MONGODB_URI)
}

/** Disconnect from MongoDB gracefully. */
export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect()
}

export { mongoose }
