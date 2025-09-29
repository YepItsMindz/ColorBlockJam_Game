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
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }

    onMouseDown(event: EventMouse) {
        const ray = this.camera.screenPointToRay(
            event.getLocationX(),
            event.getLocationY()
        );
        if (PhysicsSystem.instance.raycastClosest(ray)) {
            const hit = PhysicsSystem.instance.raycastClosestResult;
            this.selectedBody = hit.collider.getComponent(RigidBody);
            console.log(this.selectedBody.node.name);
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
                this.selectedBody.linearFactor = new Vec3(1, 1, 0);
                this.selectedBody.angularFactor = new Vec3(0, 0, 0);
            }

            this.selectedNode = hit.collider.node;
            this.fixedZ = this.selectedNode.worldPosition.z;

            // offset từ hitpoint tới tâm node
            this.offset = new Vec3();
            Vec3.subtract(
                this.offset,
                hit.hitPoint,
                this.selectedNode.worldPosition
            );
            console.log(
                ColorType[this.selectedNode.getComponent(BlockPrefab).color]
            );
            this.targetPos = new Vec3(this.selectedNode.worldPosition);
        }
    }

    onMouseMove(event: EventMouse) {
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

    onMouseUp() {
        if (this.selectedBody) {
            this.snapBlockToGrid(this.selectedNode);
            this.selectedNode
                .getComponent(BlockPrefab)
                .setBlockRect(
                    this.selectedNode.position,
                    this.selectedNode.rotation,
                    this.selectedNode.getComponent(BlockPrefab).blockGroupType
                );

            console.log(this.isCanPass());
            this.selectedBody.linearFactor = new Vec3(0, 0, 0);
            this.selectedBody.setLinearVelocity(Vec3.ZERO);
            this.selectedBody.setAngularVelocity(Vec3.ZERO);
            if (this.isCanPass()) {
                // this.tweenBlockThroughGate(this.selectedNode);
            } else {
                // Nếu không thể đi qua cổng, dừng block tại vị trí hiện tại
            }
        }
        this.selectedNode = null;
        this.selectedBody = null;
        this.targetPos = null;
    }

    // tweenBlockThroughGate(block: Node) {
    //     if (!block) return;

    //     const blockPrefab = block.getComponent(BlockPrefab);
    //     if (!blockPrefab) return;

    //     // Tìm cổng mà block đang tương tác
    //     let targetGate: Node = null;
    //     if (Array.isArray(this.gm.gateNode)) {
    //         for (const gateNode of this.gm.gateNode) {
    //             const gatePrefab = gateNode.getComponent(GatePrefab);
    //             if (gatePrefab && gatePrefab.rect && blockPrefab.rect) {
    //                 if (
    //                     Intersection2D.rectRect(
    //                         blockPrefab.rect,
    //                         gatePrefab.rect
    //                     )
    //                 ) {
    //                     targetGate = gateNode;
    //                     break;
    //                 }
    //             }
    //         }
    //     }

    //     if (!targetGate) return;

    //     const gatePrefab = targetGate.getComponent(GatePrefab);
    //     if (!gatePrefab) return;

    //     // Tính toán vị trí đích dựa trên doorDir
    //     const gatePos = targetGate.getWorldPosition();
    //     const blockPos = block.getWorldPosition();
    //     let targetPosition: Vec3;

    //     if (gatePrefab.doorDir === 1) {
    //         // Horizontal door - di chuyển theo trục X
    //         targetPosition = new Vec3(
    //             gatePos.x + 6, // Di chuyển qua bên phải cổng
    //             blockPos.y, // Giữ nguyên y
    //             blockPos.z // Giữ nguyên z
    //         );
    //     } else {
    //         // Vertical door (doorDir === 0) - di chuyển theo trục Y
    //         targetPosition = new Vec3(
    //             blockPos.x, // Giữ nguyên x
    //             gatePos.y + 6, // Di chuyển lên trên cổng
    //             blockPos.z // Giữ nguyên z
    //         );
    //     }

    //     // Đánh dấu block đã đi qua cổng
    //     blockPrefab.hasPassedThroughGate = true;

    //     // Tạo tween animation
    //     tween(block)
    //         .to(
    //             1.0,
    //             {
    //                 worldPosition: targetPosition,
    //             },
    //             {
    //                 easing: 'quadOut',
    //             }
    //         )
    //         .call(() => {
    //             // Callback khi hoàn thành tween
    //             console.log(`Block ${block.name} đã đi qua cổng thành công!`);

    //             // Dừng hoàn toàn block sau khi đi qua cổng
    //             const rigidBody = block.getComponent(RigidBody);
    //             if (rigidBody) {
    //                 rigidBody.linearFactor = new Vec3(0, 0, 0);
    //                 rigidBody.setLinearVelocity(Vec3.ZERO);
    //                 rigidBody.setAngularVelocity(Vec3.ZERO);
    //             }
    //         })
    //         .start();
    // }

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

    isCanPass(): boolean {
        if (!this.selectedNode) return false;

        const blockPrefab = this.selectedNode.getComponent(BlockPrefab);
        if (!blockPrefab || !blockPrefab.rect) return false;

        if (Array.isArray(this.gm.gateNode)) {
            for (const gateNode of this.gm.gateNode) {
                const gatePrefab = gateNode.getComponent(GatePrefab);
                if (!gatePrefab || !gatePrefab.rect) continue;

                // Check if block is in contact with this gate
                const isInContact = Intersection2D.rectRect(
                    blockPrefab.rect,
                    gatePrefab.rect
                );
                for (const blockNode of this.gm.blockNode) {
                    const block = blockNode.getComponent(BlockPrefab);
                    if (!block || !block.rect) continue;

                    const isOverLap = this.rectOverlapStrict(
                        block.rect,
                        blockPrefab.rect
                    );

                    if (isInContact && !isOverLap) {
                        console.log(blockPrefab, gatePrefab);
                        // Check if block has passed through the gate (block's right edge > gate's right edge)
                        if (gatePrefab.doorDir == 1) {
                            return (
                                blockPrefab.rect.xMin >= gatePrefab.rect.xMin &&
                                blockPrefab.rect.xMax <= gatePrefab.rect.xMax
                            );
                        } else {
                            return (
                                blockPrefab.rect.yMin >= gatePrefab.rect.yMin &&
                                blockPrefab.rect.yMax <= gatePrefab.rect.yMax
                            );
                        }
                    }
                }
            }
        }
        return false;
    }

    rectOverlapStrict(a: Rect, b: Rect): boolean {
        if (a.xMax <= b.xMin || a.xMin >= b.xMax) return false;
        if (a.yMax <= b.yMin || a.yMin >= b.yMax) return false;
        return true;
    }
}
