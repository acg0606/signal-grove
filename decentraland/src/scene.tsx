import { engine, Entity, Transform, MeshRenderer, MeshCollider, Material, TextShape, pointerEventsSystem, InputAction } from '@dcl/sdk/ecs'
import { Color4, Vector3 } from '@dcl/sdk/math'
import { MessageBus } from '@dcl/sdk/message-bus'
import { getPlayer, onEnterScene, onLeaveScene } from '@dcl/sdk/src/players'
import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button } from '@dcl/sdk/react-ecs'
import { describeGrove, mergeSignal, mergeRemoteSignal, ROLES, type Role, type Room, type Signal } from './room'
import { describeHud, HUD_COLORS } from './presentation'

const palette = HUD_COLORS
let room: Room = {}
let role: Role | null = null
let revision = 0
let me = ''
let seconds = 0
let bloom: Entity
let sign: Entity
const bus = new MessageBus()
let lastStatus = ''

function publishSignal() {
  const player = getPlayer()
  if (!player?.userId) { me = ''; refreshGrove(); return }
  me = player.userId.toLowerCase()
  const signal: Signal = { schema: 'signal-grove/1', playerId: me, revision: ++revision, role }
  room = mergeSignal(room, signal, Date.now())
  bus.emit('signal-grove-choice', signal)
  refreshGrove()
}

function choose(next: Role) { role = next; publishSignal() }

function box(position: Vector3, scale: Vector3, color: Color4, solid = false) {
  const entity = engine.addEntity()
  Transform.create(entity, { position, scale })
  MeshRenderer.setBox(entity)
  if (solid) MeshCollider.setBox(entity)
  Material.setPbrMaterial(entity, { albedoColor: color, roughness: 1, metallic: 0 })
  return entity
}

function refreshGrove() {
  const state = describeGrove(room, Date.now())
  if (!bloom || !sign) return
  const scale = 0.6 + state.bloom * 1.8
  Transform.getMutable(bloom).scale = Vector3.create(scale, scale, scale)
  Material.setPbrMaterial(bloom, { albedoColor: state.variety === 3 ? Color4.create(0.95, 0.78, 0.38, 1) : Color4.create(0.28, 0.77, 0.55, 1), roughness: 1 })
  TextShape.getMutable(sign).text = state.status.replace(/_/g, ' ') + '\n' + describeHud(room, Date.now(), me, role).contribution
  if (state.status !== lastStatus) {
    console.log('[Signal Grove]', JSON.stringify({ mode: 'SDK7_SCENE', status: state.status, contributors: state.contributors, variety: state.variety, scriptedPlayers: 0, walletActions: 0 }))
    lastStatus = state.status
  }
}

function ui() {
  const hud = describeHud(room, Date.now(), me, role)
  return <UiEntity uiTransform={{ width: '96%', maxWidth: 410, height: 280, positionType: 'absolute', position: { left: '2%', top: '3%' }, flexDirection: 'column', padding: 12 }} uiBackground={{ color: palette.panel }}>
    <Label value="SIGNAL GROVE" fontSize={24} color={palette.text} textAlign="middle-left" uiTransform={{ height: 30, flexShrink: 0 }} />
    <Label value="Choose a role. Different roles grow the bloom." fontSize={14} color={palette.secondary} textAlign="middle-left" uiTransform={{ height: 36, flexShrink: 0 }} />
    <Label value={hud.presence} fontSize={14} color={palette.secondary} textAlign="middle-left" uiTransform={{ height: 26, flexShrink: 0 }} />
    <UiEntity uiTransform={{ height: 64, width: '100%', flexShrink: 0, justifyContent: 'space-between' }}>
      {hud.buttons.map(item => <Button key={item.role} value={item.label} fontSize={14} color={palette.ink} uiTransform={{ width: '32%', height: 58, borderWidth: 2, borderColor: item.selected ? palette.text : palette[item.role] }} uiBackground={{ color: palette[item.role] }} onMouseDown={() => choose(item.role)} />)}
    </UiEntity>
    <Label value={hud.title + '\n' + hud.action} fontSize={14} color={palette.text} textAlign="middle-left" uiTransform={{ height: 72, width: '100%', flexShrink: 0 }} />
    <Label value="No bots, rewards or wallet actions" fontSize={12} color={palette.muted} textAlign="middle-left" uiTransform={{ height: 26, flexShrink: 0 }} />
  </UiEntity>
}

export function main() {
  box(Vector3.create(8, 0.02, 8), Vector3.create(15.7, 0.1, 15.7), Color4.create(0.12, 0.22, 0.17, 1), true)
  box(Vector3.create(8, 0.12, 8), Vector3.create(11, 0.1, 11), Color4.create(0.22, 0.34, 0.24, 1))
  ROLES.forEach((item, index) => {
    const x = 4 + index * 4
    const pedestal = box(Vector3.create(x, 0.7, 7), Vector3.create(2.2, 1.3, 1.8), palette[item], true)
    pointerEventsSystem.onPointerDown({ entity: pedestal, opts: { button: InputAction.IA_POINTER, hoverText: 'Choose ' + item, maxDistance: 8 } }, () => choose(item))
    const label = engine.addEntity()
    Transform.create(label, { position: Vector3.create(x, 1.8, 7) })
    TextShape.create(label, { text: item.toUpperCase(), fontSize: 3, textColor: Color4.White() })
  })
  for (const [x, z] of [[2, 3], [14, 3], [2, 12], [14, 12], [4, 14], [12, 14]]) {
    box(Vector3.create(x, 1, z), Vector3.create(0.25, 2, 0.25), Color4.create(0.36, 0.27, 0.19, 1))
    const canopy = engine.addEntity()
    Transform.create(canopy, { position: Vector3.create(x, 2.5, z), scale: Vector3.create(1.4, 1.7, 1.4) })
    MeshRenderer.setSphere(canopy)
    Material.setPbrMaterial(canopy, { albedoColor: Color4.create(0.2, 0.46, 0.3, 1), roughness: 1 })
  }
  bloom = engine.addEntity()
  Transform.create(bloom, { position: Vector3.create(8, 2.3, 11), scale: Vector3.create(0.6, 0.6, 0.6) })
  MeshRenderer.setSphere(bloom)
  sign = engine.addEntity()
  Transform.create(sign, { position: Vector3.create(8, 4.2, 11) })
  TextShape.create(sign, { text: 'WELCOME TO SIGNAL GROVE', fontSize: 2.6, textColor: Color4.White() })
  bus.on('signal-grove-choice', (data: unknown, sender: string) => { room = mergeRemoteSignal(room, data, sender, Date.now()); refreshGrove() })
  onEnterScene(() => publishSignal())
  onLeaveScene((userId: string) => { const next = { ...room }; delete next[userId.toLowerCase()]; room = next; refreshGrove() })
  engine.addSystem((delta: number) => { seconds += delta; if (seconds >= 3) { seconds = 0; publishSignal() } })
  ReactEcsRenderer.setUiRenderer(ui)
  publishSignal()
  refreshGrove()
}
