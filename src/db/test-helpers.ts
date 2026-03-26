import mongoose from 'mongoose'

/**
 * Connect to a test MongoDB instance.
 * Uses mongodb-memory-server in CI or localhost in dev.
 * Clears all collections on each call for test isolation.
 */
export async function setupTestDB(): Promise<void> {
  // Always ensure we have a fresh connection
  if (mongoose.connection.readyState === 0) {
    const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/rebalance-test'
    await mongoose.connect(uri)
  }
  // Clear all collections for test isolation
  const collections = mongoose.connection.collections
  for (const collection of Object.values(collections)) {
    await collection.deleteMany({})
  }
}

/** Clear test database but keep connection alive for next test. */
export async function teardownTestDB(): Promise<void> {
  // Just clear collections, don't disconnect yet
  // The connection will be reused by next test's setupTestDB()
  const collections = mongoose.connection.collections
  for (const collection of Object.values(collections)) {
    await collection.deleteMany({})
  }
}
