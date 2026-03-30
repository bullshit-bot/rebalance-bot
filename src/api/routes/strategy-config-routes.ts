import { Hono } from 'hono'
import { StrategyConfigModel, STRATEGY_PRESETS } from '@db/database'
import { eventBus } from '@events/event-bus'
import {
  CreateStrategyConfigSchema,
  UpdateStrategyConfigSchema,
} from '@rebalancer/strategies/strategy-config-types'

const strategyConfigRoutes = new Hono()

/** GET / — active config + list of all configs */
strategyConfigRoutes.get('/', async (c) => {
  try {
    const configs = await StrategyConfigModel.find({}, 'name description isActive params.type version updatedAt').lean()
    const active = await StrategyConfigModel.findOne({ isActive: true }).lean()
    return c.json({ active, configs })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

/** GET /presets — built-in preset configs */
strategyConfigRoutes.get('/presets', (c) => {
  return c.json(STRATEGY_PRESETS)
})

/** GET /:name — full config by name */
strategyConfigRoutes.get('/:name', async (c) => {
  try {
    const config = await StrategyConfigModel.findOne({ name: c.req.param('name') }).lean()
    if (!config) return c.json({ error: 'Config not found' }, 404)
    return c.json(config)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

/** POST / — create new config */
strategyConfigRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json()
    const parsed = CreateStrategyConfigSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400)

    const existing = await StrategyConfigModel.findOne({ name: parsed.data.name })
    if (existing) return c.json({ error: 'Config with this name already exists' }, 409)

    const config = await StrategyConfigModel.create({
      ...parsed.data,
      history: [{ params: parsed.data.params, changedAt: new Date() }],
    })
    return c.json(config, 201)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

/** POST /from-preset — create config from preset */
strategyConfigRoutes.post('/from-preset', async (c) => {
  try {
    const { presetName, configName } = await c.req.json() as { presetName: string; configName: string }
    const preset = STRATEGY_PRESETS[presetName as keyof typeof STRATEGY_PRESETS]
    if (!preset) return c.json({ error: `Unknown preset: ${presetName}` }, 400)
    if (!configName) return c.json({ error: 'configName required' }, 400)

    const config = await StrategyConfigModel.create({
      name: configName,
      description: preset.description,
      params: preset.params,
      globalSettings: preset.globalSettings,
      presetName,
      history: [{ params: preset.params, changedAt: new Date() }],
    })
    return c.json(config, 201)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

/** PUT /:name — update existing config */
strategyConfigRoutes.put('/:name', async (c) => {
  try {
    const body = await c.req.json()
    const parsed = UpdateStrategyConfigSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400)

    const config = await StrategyConfigModel.findOne({ name: c.req.param('name') })
    if (!config) return c.json({ error: 'Config not found' }, 404)

    if (parsed.data.params) {
      config.params = parsed.data.params as Record<string, unknown>
      config.history.push({ params: parsed.data.params as Record<string, unknown>, changedAt: new Date() })
    }
    if (parsed.data.description !== undefined) config.description = parsed.data.description
    if (parsed.data.globalSettings) {
      config.globalSettings = { ...config.globalSettings, ...parsed.data.globalSettings } as Record<string, unknown>
    }
    config.version += 1
    config.updatedAt = new Date()
    await config.save()

    // Notify if this is the active config
    if (config.isActive) {
      eventBus.emit('strategy:config-changed', config.toObject())
    }
    return c.json(config)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

/** DELETE /:name — delete config (cannot delete active) */
strategyConfigRoutes.delete('/:name', async (c) => {
  try {
    const config = await StrategyConfigModel.findOne({ name: c.req.param('name') })
    if (!config) return c.json({ error: 'Config not found' }, 404)
    if (config.isActive) return c.json({ error: 'Cannot delete active config' }, 400)
    await config.deleteOne()
    return c.json({ deleted: config.name })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

/** POST /:name/activate — deactivate all others, activate target atomically */
strategyConfigRoutes.post('/:name/activate', async (c) => {
  try {
    const name = c.req.param('name')

    // Verify the target config exists before making any changes
    const exists = await StrategyConfigModel.exists({ name })
    if (!exists) return c.json({ error: 'Config not found' }, 404)

    // Atomic: deactivate all + activate target in single bulkWrite
    await StrategyConfigModel.bulkWrite([
      { updateMany: { filter: { isActive: true }, update: { isActive: false } } },
      { updateOne: { filter: { name }, update: { isActive: true, updatedAt: new Date() } } },
    ])

    const target = await StrategyConfigModel.findOne({ name }).lean()
    if (!target) return c.json({ error: 'Config not found' }, 404)

    // Emit event for hot-reload
    eventBus.emit('strategy:config-changed', target.toObject())

    return c.json({ activated: target.name, params: target.params })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

export { strategyConfigRoutes }
