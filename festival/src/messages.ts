import { Schemas } from '@dcl/sdk/ecs'
import { registerMessages } from '@dcl/sdk/network'
export const room = registerMessages({
  intent: Schemas.Map({ request: Schemas.Int, json: Schemas.String }),
  notebook: Schemas.Map({ request: Schemas.Int }),
  clock: Schemas.Map({ at: Schemas.Int64 }),
  pong: Schemas.Map({ at: Schemas.Int64, now: Schemas.Int64 }),
  snapshot: Schemas.Map({ json: Schemas.String, now: Schemas.Int64, ready: Schemas.Boolean }),
  reply: Schemas.Map({ request: Schemas.Int, accepted: Schemas.Boolean, message: Schemas.String }),
  memories: Schemas.Map({ json: Schemas.String }),
  enrollment: Schemas.Map({ json: Schemas.String, now: Schemas.Int64 })
})
