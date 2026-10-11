import mongoose from 'mongoose'

/**
 * Connect to MongoDB when MONGODB_URI is configured.
 * If it is missing or unreachable, the API falls back to an in-memory store so
 * it still runs for local development. It never crashes the process.
 */
export async function connectDb() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.log('[synq-api] MONGODB_URI not set — using the in-memory store.')
    return null
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
    console.log('[synq-api] Connected to MongoDB.')
    return mongoose.connection
  } catch (err) {
    console.warn('[synq-api] MongoDB unavailable — using the in-memory store.', err.message)
    return null
  }
}

export default mongoose
