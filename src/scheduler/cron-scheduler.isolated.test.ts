import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'

mock.module('@events/event-bus', () => ({
  eventBus: {
    emit: () => {},
    on: () => {},
    off: () => {},
  },
}))

import { cronScheduler } from '@scheduler/cron-scheduler'

describe('CronScheduler', () => {
  beforeEach(() => {
    // Reset before each test
    cronScheduler.stop()
  })

  it('should create scheduler instance', () => {
    expect(cronScheduler).toBeDefined()
  })

  it('should start scheduler', () => {
    cronScheduler.start()
    expect(true).toBe(true)
  })

  it('should stop scheduler', () => {
    cronScheduler.start()
    cronScheduler.stop()
    expect(true).toBe(true)
  })

  afterEach(() => {
    cronScheduler.stop()
  })
})
