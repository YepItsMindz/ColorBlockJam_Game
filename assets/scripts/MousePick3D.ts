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

    // Biến lưu trạng thái connected blocks
    private connectedBlockOffset: Vec3 | null = null;
    private connectedBlockWasVisible: boolean = false;

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
                if (this.selectedNode.getComponent(BlockPrefab).iceCount > 1) {
                    this.selectedBody.linearFactor = new Vec3(0, 0, 0);
                } else if (
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

                // Xử lý connected block
                const connectedBlock =
                    this.selectedNode.getComponent(BlockPrefab).connectedBlock;
                if (connectedBlock) {
                    // Lưu khoảng cách tương đối giữa block chính và connected block
                    this.connectedBlockOffset = new Vec3();
                    Vec3.subtract(
                        this.connectedBlockOffset,
                        connectedBlock.worldPosition,
                        this.selectedNode.worldPosition
                    );

                    // Lưu trạng thái hiển thị ban đầu và ẩn connected block
                    this.connectedBlockWasVisible = connectedBlock.active;
                    connectedBlock.active = false;

                    // Set linear factor cho connected block
                    connectedBlock.getComponent(RigidBody).linearFactor =
                        new Vec3(1, 1, 0);
                }
            }

            this.fixedZ = this.selectedNode.worldPosition.z; // offset từ hitpoint tới tâm node
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

            // Cập nhật connected block nếu có
            this.updateConnectedBlockPosition();
        } else {
            dir.normalize();
            dir.multiplyScalar(this.speed);

            const force = dir.multiplyScalar(dist * this.stiffness);

            const vel = new Vec3();
            this.selectedBody.getLinearVelocity(vel);
            const dampingForce = vel.multiplyScalar(-this.damping);

            force.add(dampingForce);

            this.selectedBody.applyForce(force);

            // Cập nhật connected block nếu có
            this.updateConnectedBlockPosition();
        }
    }

    updateConnectedBlockPosition() {
        const connectedBlock =
            this.selectedNode?.getComponent(BlockPrefab)?.connectedBlock;
        if (
            connectedBlock &&
            this.connectedBlockOffset &&
            !connectedBlock.active
        ) {
            // Chỉ cập nhật khi connected block đang bị ẩn (trong lúc drag)
            const newConnectedPos = new Vec3();
            Vec3.add(
                newConnectedPos,
                this.selectedNode.worldPosition,
                this.connectedBlockOffset
            );

            // Cập nhật vị trí connected block (dù nó đang bị ẩn)
            connectedBlock.setWorldPosition(newConnectedPos);

            // Cập nhật rect cho connected block
            connectedBlock
                .getComponent(BlockPrefab)
                .setBlockRect(
                    connectedBlock.position,
                    connectedBlock.eulerAngles,
                    connectedBlock.getComponent(BlockPrefab).blockGroupType
                );
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

            // Xử lý connected block khi thả
            const connectedBlock =
                this.selectedNode.getComponent(BlockPrefab).connectedBlock;
            if (connectedBlock && this.connectedBlockOffset) {
                // Hiện lại connected block
                connectedBlock.active = this.connectedBlockWasVisible;

                // Tìm ConnectedBlockClone để lấy vị trí
                const connectedBlockClone = this.selectedNode.getChildByName(
                    'ConnectedBlockClone'
                );
                let newConnectedPos = new Vec3();

                if (connectedBlockClone) {
                    // Set vị trí theo ConnectedBlockClone
                    newConnectedPos = connectedBlockClone.getWorldPosition();
                } else {
                    // Fallback: tính vị trí dựa trên offset như cũ
                    Vec3.add(
                        newConnectedPos,
                        this.selectedNode.worldPosition,
                        this.connectedBlockOffset
                    );
                }

                // Đặt connected block ở vị trí mới
                connectedBlock.setWorldPosition(newConnectedPos);

                // Snap connected block to grid
                this.snapBlockToGrid(connectedBlock);

                // Cập nhật rect cho connected block
                connectedBlock
                    .getComponent(BlockPrefab)
                    .setBlockRect(
                        connectedBlock.position,
                        connectedBlock.eulerAngles,
                        connectedBlock.getComponent(BlockPrefab).blockGroupType
                    );

                // Set linear factor về 0
                connectedBlock.getComponent(RigidBody).linearFactor = new Vec3(
                    0,
                    0,
                    0
                );
                connectedBlock
                    .getComponent(RigidBody)
                    .setLinearVelocity(Vec3.ZERO);
                connectedBlock
                    .getComponent(RigidBody)
                    .setAngularVelocity(Vec3.ZERO);
            }

            this.isCanPass();
            this.selectedBody.linearFactor = new Vec3(0, 0, 0);
            this.selectedBody.setLinearVelocity(Vec3.ZERO);
            this.selectedBody.setAngularVelocity(Vec3.ZERO);
        }

        // Reset các biến trạng thái
        this.selectedNode = null;
        this.selectedBody = null;
        this.targetPos = null;
        this.connectedBlockOffset = null;
        this.connectedBlockWasVisible = false;
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

        // Kiểm tra từng cổng
        for (const gateNode of this.gm.gateNode) {
            const gatePrefab = gateNode.getComponent(GatePrefab);
            if (!gatePrefab || !gatePrefab.rect) continue;

            let mainBlockCanPass = false;
            let connectedCanPass = false;
            let mainBlockInContact = false;
            let connectedBlockInContact = false;

            // Kiểm tra block chính
            if (gatePrefab.color == blockPrefab.color) {
                mainBlockInContact = Intersection2D.rectRect(
                    blockPrefab.rect,
                    gatePrefab.rect
                );

                if (mainBlockInContact) {
                    if (gatePrefab.doorDir == 1) {
                        mainBlockCanPass =
                            blockPrefab.rect.xMin >= gatePrefab.rect.xMin &&
                            blockPrefab.rect.xMax <= gatePrefab.rect.xMax;
                    } else {
                        mainBlockCanPass =
                            blockPrefab.rect.yMin >= gatePrefab.rect.yMin &&
                            blockPrefab.rect.yMax <= gatePrefab.rect.yMax;
                    }
                }
            }

            // Kiểm tra connected block độc lập
            const connectedBlock = blockPrefab.connectedBlock;
            if (connectedBlock) {
                const connectedBlockPrefab =
                    connectedBlock.getComponent(BlockPrefab);
                if (connectedBlockPrefab && connectedBlockPrefab.rect) {
                    // Kiểm tra connected block với cổng hiện tại
                    if (gatePrefab.color === connectedBlockPrefab.color) {
                        connectedBlockInContact = Intersection2D.rectRect(
                            connectedBlockPrefab.rect,
                            gatePrefab.rect
                        );

                        if (connectedBlockInContact) {
                            if (gatePrefab.doorDir == 1) {
                                connectedCanPass =
                                    connectedBlockPrefab.rect.xMin >=
                                        gatePrefab.rect.xMin &&
                                    connectedBlockPrefab.rect.xMax <=
                                        gatePrefab.rect.xMax;
                            } else {
                                connectedCanPass =
                                    connectedBlockPrefab.rect.yMin >=
                                        gatePrefab.rect.yMin &&
                                    connectedBlockPrefab.rect.yMax <=
                                        gatePrefab.rect.yMax;
                            }
                        }
                    }
                }
            }

            // Nếu có block nào đó contact với cổng thì xử lý
            if (mainBlockInContact || connectedBlockInContact) {
                let hasOverlap = false;

                for (const blockNode of this.gm.blockNode) {
                    const block = blockNode.getComponent(BlockPrefab);
                    if (!block || !block.rect) continue;
                    if (blockNode === this.selectedNode) continue;
                    if (blockNode === connectedBlock) continue; // Bỏ qua connected block

                    // Kiểm tra overlap nếu cần
                }

                if (!hasOverlap) {
                    // Xử lý các trường hợp khác nhau
                    if (mainBlockCanPass && connectedCanPass) {
                        // Cả hai đều qua được - cả hai đi qua
                        console.log('Both blocks can pass through gate');
                        this.cloneNode();
                        this.selectedNode.getChildByName('Layer').active =
                            false;
                        this.passThroughGate(gateNode, gatePrefab, true, true);
                    } else if (mainBlockCanPass && !connectedCanPass) {
                        // Chỉ block chính qua được - block chính đi qua, connected block bị ẩn
                        console.log(
                            'Only main block can pass, connected block will be hidden'
                        );
                        this.cloneNode();
                        this.selectedNode.getChildByName('Layer').active =
                            false;
                        this.passThroughGate(gateNode, gatePrefab, true, false);
                    } else if (!mainBlockCanPass && connectedCanPass) {
                        // Chỉ connected block qua được - connected block đi qua, block chính bị ẩn
                        console.log(
                            'Only connected block can pass, main block will be hidden'
                        );
                        this.passThroughGate(gateNode, gatePrefab, false, true);
                    }
                    // Nếu cả hai đều không qua được thì không làm gì cả
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

    passThroughGate(
        gateNode: Node,
        gatePrefab: GatePrefab,
        mainBlockPasses: boolean = true,
        connectedBlockPasses: boolean = true
    ) {
        for (const blockNode of this.gm.blockNode) {
            const block = blockNode.getComponent(BlockPrefab);
            if (block.iceCount > 1) block.iceCount -= 1;
            if (block.iceCount == 1) block.setColorType(block.color);
        }

        const selectedNode = this.selectedNode;
        const selectedBody = this.selectedBody;
        if (!selectedNode || !selectedBody) return;

        const blockPos = selectedNode.getWorldPosition();
        const gatePos = gateNode.getWorldPosition();
        const gateDir = gatePrefab.doorDir;

        // Xử lý block chính
        if (mainBlockPasses) {
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

            // Nếu block chính qua cổng và có connected block, hiện connected block
            const connectedBlock =
                selectedNode.getComponent(BlockPrefab).connectedBlock;
            if (connectedBlock && !connectedBlockPasses) {
                // Hiện connected block khi block chính qua cổng
                connectedBlock.active = true;

                // Ẩn ConnectedBlockClone
                const connectedBlockClone = selectedNode.getChildByName(
                    'ConnectedBlockClone'
                );
                if (connectedBlockClone) {
                    connectedBlock.setWorldPosition(
                        connectedBlockClone.getWorldPosition()
                    );
                    // Ẩn ConnectedBlockClone
                    connectedBlockClone.active = false;

                    // Snap connected block to grid
                    this.snapBlockToGrid(connectedBlock);
                    // Cập nhật rect
                    connectedBlock
                        .getComponent(BlockPrefab)
                        .setBlockRect(
                            connectedBlock.position,
                            connectedBlock.eulerAngles,
                            connectedBlock.getComponent(BlockPrefab)
                                .blockGroupType
                        );
                }

                // Bật lại collider cho connected block
                const connectedColliders =
                    connectedBlock.getComponents(Collider);
                for (const collider of connectedColliders) {
                    collider.enabled = true;
                }

                // Ngắt kết nối
                selectedNode.getComponent(BlockPrefab).connectedBlock = null;
                if (connectedBlock.getComponent(BlockPrefab)) {
                    connectedBlock.getComponent(BlockPrefab).connectedBlock =
                        null;
                }
            }

            // Tween cho block chính
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
                            selectedNode.getComponent(BlockPrefab)
                                .blockGroupType
                        );
                    selectedBody.linearFactor = new Vec3(0, 0, 0);
                    selectedBody.setLinearVelocity(Vec3.ZERO);
                    selectedBody.setAngularVelocity(Vec3.ZERO);
                })
                .start();
        } else {
            // Nếu block chính không qua được thì giữ nguyên vị trí và reset physics
            selectedBody.linearFactor = new Vec3(0, 0, 0);
            selectedBody.setLinearVelocity(Vec3.ZERO);
            selectedBody.setAngularVelocity(Vec3.ZERO);
        }

        // Xử lý connected block
        const connectedBlock =
            selectedNode.getComponent(BlockPrefab).connectedBlock;
        if (connectedBlock) {
            if (connectedBlockPasses) {
                // Connected block đi qua cổng
                const connectedBlockPos = connectedBlock.getWorldPosition();
                connectedBlock.getComponent(BlockPrefab).hasPassedThroughGate =
                    true;
                let connectedTargetPos = new Vec3();

                if (gateDir === 1) {
                    connectedTargetPos.set(
                        connectedBlockPos.x,
                        gatePos.y + (gatePos.y - connectedBlockPos.y),
                        connectedBlockPos.z
                    );
                } else {
                    connectedTargetPos.set(
                        gatePos.x + (gatePos.x - connectedBlockPos.x),
                        connectedBlockPos.y,
                        connectedBlockPos.z
                    );
                }

                // Tắt ConnectedBlockClone là con của block chính
                const connectedBlockClone = selectedNode.getChildByName(
                    'ConnectedBlockClone'
                );
                if (connectedBlockClone) {
                    connectedBlockClone.active = false;
                }

                // Ngắt kết nối trước khi connected block đi qua cổng
                selectedNode.getComponent(BlockPrefab).connectedBlock = null;
                if (connectedBlock.getComponent(BlockPrefab)) {
                    connectedBlock.getComponent(BlockPrefab).connectedBlock =
                        null;
                }

                const connectedBody = connectedBlock.getComponent(RigidBody);
                tween(connectedBlock)
                    .to(
                        0.3,
                        {
                            position: connectedTargetPos,
                        },
                        {
                            easing: 'sineInOut',
                        }
                    )
                    .call(() => {
                        connectedBlock
                            .getComponent(BlockPrefab)
                            .setBlockRect(
                                connectedBlock.position,
                                connectedBlock.eulerAngles,
                                connectedBlock.getComponent(BlockPrefab)
                                    .blockGroupType
                            );
                        if (connectedBody) {
                            connectedBody.linearFactor = new Vec3(0, 0, 0);
                            connectedBody.setLinearVelocity(Vec3.ZERO);
                            connectedBody.setAngularVelocity(Vec3.ZERO);
                        }
                    })
                    .start();
            } else {
                // Connected block không qua được thì ẩn nó và ngắt kết nối
                connectedBlock.active = false;
                selectedNode.getComponent(BlockPrefab).connectedBlock = null;
                if (connectedBlock.getComponent(BlockPrefab)) {
                    connectedBlock.getComponent(BlockPrefab).connectedBlock =
                        null;
                }
            }
        }
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
