import {
    _decorator,
    Component,
    Camera,
    input,
    Input,
    EventMouse,
    PhysicsSystem,
    Vec3,
    RigidBody,
    ERigidBodyType,
    tween,
    Node,
    Collider,
    geometry,
    Collider2D,
    Intersection2D,
    Vec2,
    Rect,
    instantiate,
    EventTouch,
} from 'cc';
import { GameManager } from './GameManager';
import { BlockPrefab } from './prefab/BlockPrefab';
import { ColorType } from './GameConstant';
import { GatePrefab } from './prefab/GatePrefab';
const { AABB } = geometry;
const { ccclass, property } = _decorator;

export const GRID_SIZE = 2;

@ccclass('MouseJoint3D')
export class MouseJoint3D extends Component {
    @property(Camera)
    camera: Camera = null!;

    @property
    speed: number = 0;

    @property
    stiffness: number = 0;

    @property
    damping: number = 0;

    @property(GameManager)
    gm: GameManager;

    private selectedBody: RigidBody | null = null;
    private selectedNode: Node = null;
    private offset: Vec3 = new Vec3();
    private targetPos: Vec3 | null = null;
    private fixedZ = 0;
    private gridPos: { x: number; y: number } = null;

    start() {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    onTouchStart(event: EventMouse | EventTouch) {
        const ray = this.camera.screenPointToRay(
            event.getLocationX(),
            event.getLocationY()
        );
        if (PhysicsSystem.instance.raycastClosest(ray)) {
            const hit = PhysicsSystem.instance.raycastClosestResult;
            this.selectedBody = hit.collider.getComponent(RigidBody);
            this.selectedNode = hit.collider.node;
            if (!this.selectedBody) return;

            if (
                this.selectedBody.group === 4 ||
                this.selectedBody.group === 1
            ) {
                this.selectedBody = null; // nhóm Obstacle, Gate không cho kéo
                return;
            }

            // Kiểm tra nếu block đã đi qua cổng thì không cho kéo nữa
            const blockPrefab = hit.collider.node.getComponent(BlockPrefab);
            if (blockPrefab && blockPrefab.hasPassedThroughGate) {
                console.log(
                    'Block has passed through gate and cannot be moved anymore!'
                );
                this.selectedBody = null;
                this.selectedNode = null;
                return;
            }

            if (this.selectedBody) {
                // this.selectedBody.type = RigidBody.Type.DYNAMIC;
                // this.selectedBody.useGravity = false;
                if (
                    this.selectedNode.getComponent(BlockPrefab)
                        .isOneWayMovementActive
                ) {
                    if (
                        this.selectedNode.getComponent(BlockPrefab)
                            .wayDirection == 0
                    ) {
                        if (
                            Math.round(this.selectedNode.eulerAngles.z) == 0 ||
                            Math.round(this.selectedNode.eulerAngles.z) == 180
                        )
                            this.selectedBody.linearFactor = new Vec3(1, 0, 0);
                        else this.selectedBody.linearFactor = new Vec3(0, 1, 0);
                    } else {
                        if (
                            Math.round(this.selectedNode.eulerAngles.z) == 0 ||
                            Math.round(this.selectedNode.eulerAngles.z) == 180
                        )
                            this.selectedBody.linearFactor = new Vec3(0, 1, 0);
                        else this.selectedBody.linearFactor = new Vec3(1, 0, 0);
                    }
                } else this.selectedBody.linearFactor = new Vec3(1, 1, 0);
                this.selectedBody.angularFactor = new Vec3(0, 0, 0);
            }

            this.fixedZ = this.selectedNode.worldPosition.z;

            // offset từ hitpoint tới tâm node
            this.offset = new Vec3();
            Vec3.subtract(
                this.offset,
                hit.hitPoint,
                this.selectedNode.worldPosition
            );
            this.targetPos = new Vec3(this.selectedNode.worldPosition);
        }
    }

    onTouchMove(event: EventMouse | EventTouch) {
        if (!this.selectedNode || !this.selectedBody) return;

        // Kiểm tra lại nếu block đã đi qua cổng
        const blockPrefab = this.selectedNode.getComponent(BlockPrefab);
        if (blockPrefab && blockPrefab.hasPassedThroughGate) {
            this.selectedBody = null;
            this.selectedNode = null;
            return;
        }

        const ray = this.camera.screenPointToRay(
            event.getLocationX(),
            event.getLocationY()
        );
        const t = (this.fixedZ - ray.o.z) / ray.d.z;

        if (t > 0) {
            const hitPoint = new Vec3(
                ray.o.x + ray.d.x * t,
                ray.o.y + ray.d.y * t,
                this.fixedZ
            );

            // Cập nhật targetPos thay vì applyForce trực tiếp
            this.targetPos = new Vec3();
            Vec3.subtract(this.targetPos, hitPoint, this.offset);

            // Giới hạn targetPos trong phạm vi grid
            this.clampToGrid(this.targetPos);
        }
    }

    update(dt: number) {
        if (!this.selectedBody || !this.targetPos) return;

        const currentPos = this.selectedNode.getWorldPosition();
        const dir = new Vec3();
        Vec3.subtract(dir, this.targetPos, currentPos);
        const dist = dir.length();

        if (dist < 0.001) {
            // gần target thì snap
            this.selectedBody.setLinearVelocity(Vec3.ZERO);
            this.selectedBody.node.setWorldPosition(this.targetPos);
        } else {
            dir.normalize();
            dir.multiplyScalar(this.speed);

            const force = dir.multiplyScalar(dist * this.stiffness);

            const vel = new Vec3();
            this.selectedBody.getLinearVelocity(vel);
            const dampingForce = vel.multiplyScalar(-this.damping);

            force.add(dampingForce);

            this.selectedBody.applyForce(force);
        }
    }

    onTouchEnd(event: EventMouse | EventTouch) {
        if (this.selectedBody) {
            this.snapBlockToGrid(this.selectedNode);

            this.selectedNode
                .getComponent(BlockPrefab)
                .setBlockRect(
                    this.selectedNode.position,
                    this.selectedNode.eulerAngles,
                    this.selectedNode.getComponent(BlockPrefab).blockGroupType
                );

            this.isCanPass();
            this.selectedBody.linearFactor = new Vec3(0, 0, 0);
            this.selectedBody.setLinearVelocity(Vec3.ZERO);
            this.selectedBody.setAngularVelocity(Vec3.ZERO);
        }
        this.selectedNode = null;
        this.selectedBody = null;
        this.targetPos = null;
    }

    clampToGrid(targetPos: Vec3) {
        if (!this.gm || !this.gm.gridSize) return;
        const cols = (this.gm.gridSize.x - 1) / 2;
        const rows = (this.gm.gridSize.y - 1) / 2;
        const minX = -cols * GRID_SIZE;
        const maxX = cols * GRID_SIZE;

        const minY = -rows * GRID_SIZE;
        const maxY = rows * GRID_SIZE;

        targetPos.x = Math.max(minX, Math.min(maxX, targetPos.x));
        targetPos.y = Math.max(minY, Math.min(maxY, targetPos.y));
    }

    snapBlockToGrid(block: Node) {
        const worldPos: Vec3 = block.getWorldPosition();
        let gx = Math.round(worldPos.x / GRID_SIZE);
        let gy = Math.round(worldPos.y / GRID_SIZE);

        const parts = block.name.split('_');
        const blockType = parts[parts.length - 1];

        const h = this.gm.gridSize.y;
        const w = this.gm.gridSize.x;

        if (blockType == 'Square' || blockType == 'ShortL') {
            if (w % 2 === 1) {
                if (gx * GRID_SIZE > worldPos.x) gx -= 0.5;
                else gx += 0.5;
            }

            if (h % 2 === 1) {
                if (gy * GRID_SIZE > worldPos.y) gy -= 0.5;
                else gy += 0.5;
            }
        }

        if (blockType == 'Three' || blockType == 'Plus' || blockType == 'One') {
            if (w % 2 === 0) {
                if (gx * GRID_SIZE > worldPos.x) gx -= 0.5;
                else gx += 0.5;
            }

            if (h % 2 === 0) {
                if (gy * GRID_SIZE > worldPos.y) gy -= 0.5;
                else gy += 0.5;
            }
        }

        if (blockType == 'L' || blockType == 'U' || blockType == 'ReverseL') {
            if (
                Math.round(block.eulerAngles.z) == 0 ||
                Math.round(block.eulerAngles.z) == 180
            ) {
                if (w % 2 === 1) {
                    if (gx * GRID_SIZE > worldPos.x) gx -= 0.5;
                    else gx += 0.5;
                }

                if (h % 2 === 0) {
                    if (gy * GRID_SIZE > worldPos.y) gy -= 0.5;
                    else gy += 0.5;
                }
            } else {
                if (w % 2 === 0) {
                    if (gx * GRID_SIZE > worldPos.x) gx -= 0.5;
                    else gx += 0.5;
                }

                if (h % 2 === 1) {
                    if (gy * GRID_SIZE > worldPos.y) gy -= 0.5;
                    else gy += 0.5;
                }
            }
        }

        if (
            blockType == 'Two' ||
            blockType == 'ShortT' ||
            blockType == 'Z' ||
            blockType == 'ReverseZ'
        ) {
            if (
                Math.round(block.eulerAngles.z) == 0 ||
                Math.round(block.eulerAngles.z) == 180
            ) {
                if (w % 2 === 0) {
                    if (gx * GRID_SIZE > worldPos.x) gx -= 0.5;
                    else gx += 0.5;
                }

                if (h % 2 === 1) {
                    if (gy * GRID_SIZE > worldPos.y) gy -= 0.5;
                    else gy += 0.5;
                }
            } else {
                if (w % 2 === 1) {
                    if (gx * GRID_SIZE > worldPos.x) gx -= 0.5;
                    else gx += 0.5;
                }

                if (h % 2 === 0) {
                    if (gy * GRID_SIZE > worldPos.y) gy -= 0.5;
                    else gy += 0.5;
                }
            }
        }

        const targetPos = new Vec3(gx * GRID_SIZE, gy * GRID_SIZE, this.fixedZ);
        block.setWorldPosition(targetPos);
    }

    isContact() {
        if (Array.isArray(this.gm.gateNode)) {
            for (const gateNode of this.gm.gateNode) {
                const gateRect = gateNode.getComponent(GatePrefab).rect;
                const blockRect =
                    this.selectedNode.getComponent(BlockPrefab).rect;
                return (
                    gateRect &&
                    blockRect &&
                    Intersection2D.rectRect(blockRect, gateRect)
                );
            }
        }
    }

    isCanPass() {
        if (!this.selectedNode) return false;

        const blockPrefab = this.selectedNode.getComponent(BlockPrefab);
        if (!blockPrefab || !blockPrefab.rect) return false;

        for (const gateNode of this.gm.gateNode) {
            const gatePrefab = gateNode.getComponent(GatePrefab);
            if (!gatePrefab || !gatePrefab.rect) continue;

            if (gatePrefab.color == blockPrefab.color) {
                const isInContact = Intersection2D.rectRect(
                    blockPrefab.rect,
                    gatePrefab.rect
                );
                if (isInContact) {
                    let hasOverlap = false;
                    for (const blockNode of this.gm.blockNode) {
                        const block = blockNode.getComponent(BlockPrefab);
                        if (!block || !block.rect) continue;
                        if (blockNode === this.selectedNode) continue;

                        // const isOverLap = this.rectOverlapStrict(
                        //     block.rect,
                        //     blockPrefab.rect
                        // );

                        // if (isOverLap) {
                        //     console.log(block, blockPrefab);
                        //     hasOverlap = true;
                        //     break;
                        // }
                    }

                    if (!hasOverlap) {
                        let canPassThroughThisGate = false;
                        if (gatePrefab.doorDir == 1) {
                            canPassThroughThisGate =
                                blockPrefab.rect.xMin >= gatePrefab.rect.xMin &&
                                blockPrefab.rect.xMax <= gatePrefab.rect.xMax;
                        } else {
                            canPassThroughThisGate =
                                blockPrefab.rect.yMin >= gatePrefab.rect.yMin &&
                                blockPrefab.rect.yMax <= gatePrefab.rect.yMax;
                        }
                        if (canPassThroughThisGate) {
                            this.cloneNode();
                            this.selectedNode.getChildByName('Layer').active =
                                false;
                            this.passThroughGate(gateNode, gatePrefab);
                            //return true;
                        }
                    }
                }
            }
        }
        //return false;
    }

    rectOverlapStrict(a: Rect, b: Rect): boolean {
        if (a.xMax <= b.xMin || a.xMin >= b.xMax) return false;
        if (a.yMax <= b.yMin || a.yMin >= b.yMax) return false;
        return true;
    }

    passThroughGate(gateNode: Node, gatePrefab: GatePrefab) {
        const selectedNode = this.selectedNode;
        const selectedBody = this.selectedBody;
        if (!selectedNode || !selectedBody) return;

        const blockPos = selectedNode.getWorldPosition();
        const gatePos = gateNode.getWorldPosition();
        const gateDir = gatePrefab.doorDir;
        selectedNode.getComponent(BlockPrefab).hasPassedThroughGate = true;
        let targetPos = new Vec3();

        if (gateDir === 1) {
            targetPos.set(
                blockPos.x,
                gatePos.y + (gatePos.y - blockPos.y),
                blockPos.z
            );
        } else {
            targetPos.set(
                gatePos.x + (gatePos.x - blockPos.x),
                blockPos.y,
                blockPos.z
            );
        }
        tween(selectedNode)
            .to(
                0.3,
                {
                    position: targetPos,
                },
                {
                    easing: 'sineInOut',
                }
            )
            .call(() => {
                selectedNode
                    .getComponent(BlockPrefab)
                    .setBlockRect(
                        selectedNode.position,
                        selectedNode.eulerAngles,
                        selectedNode.getComponent(BlockPrefab).blockGroupType
                    );
                selectedBody.linearFactor = new Vec3(0, 0, 0);
                selectedBody.setLinearVelocity(Vec3.ZERO);
                selectedBody.setAngularVelocity(Vec3.ZERO);
            })
            .start();
    }

    cloneNode() {
        if (this.selectedNode.getComponent(BlockPrefab).hasLayer) {
            const layerNode: Node = instantiate(this.selectedNode);

            const colliders = this.selectedBody.node.getComponents(Collider);
            for (const collider of colliders) {
                collider.enabled = false;
            }

            layerNode.getComponent(BlockPrefab).hasLayer = false;
            layerNode
                .getComponent(BlockPrefab)
                .initializeBlock(
                    this.selectedNode.position,
                    this.selectedNode.eulerAngles,
                    null,
                    null,
                    null,
                    this.selectedNode.getComponent(BlockPrefab).blockGroupType,
                    this.selectedNode.getComponent(BlockPrefab).layerColor
                );

            layerNode.getComponent(RigidBody).linearFactor = new Vec3(0, 0, 0);
            layerNode.getComponent(RigidBody).setLinearVelocity(Vec3.ZERO);
            layerNode.getComponent(RigidBody).setAngularVelocity(Vec3.ZERO);
            this.gm.blockNode.push(layerNode);
            this.gm.node.addChild(layerNode);
            this.snapBlockToGrid(layerNode);
        }
    }
}
