import {
    _decorator,
    Component,
    Node,
    MeshRenderer,
    Mesh,
    Collider,
    ICollisionEvent,
    Material,
    Vec3,
    tween,
    RigidBody,
    geometry,
    BoxCollider,
    Rect,
    instantiate,
} from 'cc';
import { ColorType } from '../GameConstant';
import { GatePrefab } from './GatePrefab';
import { GRID_SIZE, GameManager } from '../GameManager';
const { ccclass, property } = _decorator;

@ccclass('BlockPrefab')
export class BlockPrefab extends Component {
    public color: ColorType = null;
    public layerColor: ColorType = null;
    public hasLayer: boolean = false;
    public blockGroupType: number = null;
    public hasPassedThroughGate: boolean = false;
    public wayDirection: number = null;
    public isOneWayMovementActive: boolean = false;
    public iceCount: number = 1;
    public rect: Rect;
    public connectedBlock: Node | null;
    public isConnectedMerged: boolean = false;
    public groupIndex: number;

    // Lưu trữ các collider của connected block đã được thêm vào block chính
    private connectedBlockColliders: Collider[] = [];

    setLayerColor(color: ColorType) {
        this.layerColor = color;
    }

    setColorType(color: ColorType) {
        this.color = color;
        const material = GameManager.instance?.getMaterialByIndex(color);
        if (material) {
            const bl = this.node.getChildByName('Block');
            if (bl) {
                const mr = bl.getComponent(MeshRenderer);
                if (mr) mr.material = material;
            } else {
                const mr = this.node.getComponent(MeshRenderer);
                if (mr) mr.material = material;
            }
        }
    }

    setBlockGroupType(index: number) {
        this.blockGroupType = index;
    }

    setIsOneWayMovementActive(index: number) {
        if (index == 1) this.isOneWayMovementActive = true;
        else this.isOneWayMovementActive = false;
    }

    setWayDiretion(index: number) {
        if (this.isOneWayMovementActive) {
            this.wayDirection = index;
        }
    }

    setIceCount(index: number) {
        this.iceCount = index;
    }

    start() {
        const colliders = this.getComponents(Collider);

        for (const c of colliders) {
            c.on('onCollisionEnter', this.onCollisionEnter, this);
            c.on('onCollisionStay', this.onCollisionStay, this);
            c.on('onCollisionExit', this.onCollisionExit, this);
        }
    }

    onCollisionEnter(event: ICollisionEvent) {}

    onCollisionStay(event: ICollisionEvent) {
        //console.log('Đang va chạm với', event.otherCollider.node.name);
        const gateCmp = event.otherCollider.node.getComponent(GatePrefab);
        if (gateCmp) {
            // console.log(
            //     `Gate color: ${ColorType[gateCmp.color]}, Block color: ${ColorType[this.color]}`
            // );
            // const blockAABB = this.getCombinedAABB();
            // // Kiểm tra nếu màu giống nhau
            // if (
            //     gateCmp.color === this.color &&
            //     this.canPassThrough(gateCmp.node)
            // ) {
            //     this.passThroughGate(gateCmp.node, gateCmp);
            // }
        }
    }

    onCollisionExit(event: ICollisionEvent) {
        //console.log('Kết thúc va chạm với', event.otherCollider.node.name);
    }

    setCollidersEnabled(node: Node, enabled: boolean) {
        const colliders = node.getComponents(Collider);
        for (const c of colliders) {
            c.enabled = enabled;
        }
    }

    addConnectedBlockColliders(connectedBlockNode: Node) {
        // Xóa các collider cũ nếu có
        this.removeConnectedBlockColliders();

        // Lấy tất cả collider từ connected block
        const connectedColliders = connectedBlockNode.getComponents(Collider);

        for (const connectedCollider of connectedColliders) {
            // Tạo collider mới cho block chính
            const newCollider = this.node.addComponent(BoxCollider);

            // Copy các thuộc tính từ collider gốc
            if (connectedCollider instanceof BoxCollider) {
                const boxCollider = connectedCollider as BoxCollider;

                // Lấy rotation của connected block
                const connectedRotation = connectedBlockNode.eulerAngles;
                const mainRotation = this.node.eulerAngles;

                // Tính góc quay tương đối
                const relativeRotation = new Vec3();
                Vec3.subtract(
                    relativeRotation,
                    connectedRotation,
                    mainRotation
                );

                // Xét góc quay để điều chỉnh size của collider
                let adjustedSize = boxCollider.size.clone();

                // Nếu có sự khác biệt về góc quay Z (90 độ hoặc 270 độ)
                const rotationDiff = Math.abs(relativeRotation.z);
                if (
                    Math.abs(rotationDiff - 90) < 10 ||
                    Math.abs(rotationDiff - 270) < 10
                ) {
                    // Hoán đổi x và y của size
                    const temp = adjustedSize.x;
                    adjustedSize.x = adjustedSize.y;
                    adjustedSize.y = temp;
                }

                (newCollider as BoxCollider).size = adjustedSize;

                // Tính toán center mới với xét góc quay
                // Transform center của collider trong local space của connected block thành world space
                const worldCenter = new Vec3();
                Vec3.transformMat4(
                    worldCenter,
                    boxCollider.center,
                    connectedBlockNode.getWorldMatrix()
                );

                // Chuyển đổi world position thành local position của block chính
                const localCenter = new Vec3();
                this.node.inverseTransformPoint(localCenter, worldCenter);

                (newCollider as BoxCollider).center = localCenter;
            }

            // Copy material và các thuộc tính khác
            newCollider.material = connectedCollider.material;
            newCollider.isTrigger = connectedCollider.isTrigger;

            // Thêm event listener cho collider mới
            newCollider.on('onCollisionEnter', this.onCollisionEnter, this);
            newCollider.on('onCollisionStay', this.onCollisionStay, this);
            newCollider.on('onCollisionExit', this.onCollisionExit, this);

            // Lưu reference của collider mới
            this.connectedBlockColliders.push(newCollider);
        }
    }

    removeConnectedBlockColliders() {
        // Xóa các collider của connected block đã được lưu
        for (const collider of this.connectedBlockColliders) {
            if (collider && collider.isValid) {
                this.node.removeComponent(collider);
            }
        }

        // Xóa array
        this.connectedBlockColliders = [];

        // Re-enable collider của connected block nếu cần
        if (this.connectedBlock) {
            this.setCollidersEnabled(this.connectedBlock, true);
        }
    }

    // Hàm để tắt các collider của connected block mà không xóa chúng
    disableConnectedBlockColliders() {
        for (const collider of this.connectedBlockColliders) {
            if (collider && collider.isValid) {
                collider.enabled = false;
            }
        }
    }

    checkLayer() {
        if (this.hasLayer) {
            this.node.getChildByName('Layer').active = true;
        } else {
            this.node.getChildByName('Layer').active = false;
        }
    }

    setB;

    initializeBlock(
        position: { x: number; y: number; z: number },
        rotation: { x: number; y: number; z: number },
        layerData: { hasLayer: number; blockType: number } | null,
        isOneWayMovementActive: number | null,
        wayDirection: number | null,
        blockGroupLevelElementData: { iceCount: number } | null,
        joinedGroupData: {
            isMemberOfJoinedGorup: number;
            groupIndex: number;
        } | null,
        blockGroupType: number,
        blockType: ColorType
    ) {
        this.setBlockRect(position, rotation, blockGroupType);

        // Set position

        this.node.setPosition(position.x, position.y, position.z);

        // Set rotation
        if (layerData) {
            this.node.setRotationFromEuler(
                rotation.x,
                rotation.y + 180,
                rotation.z
            );
        } else {
            this.node.setRotationFromEuler(rotation.x, rotation.y, rotation.z);
        }

        // Set material - tự lấy từ GameManager
        this.setColorType(blockType);

        if (
            blockGroupLevelElementData &&
            blockGroupLevelElementData.iceCount > 1
        ) {
            this.setIceCount(blockGroupLevelElementData.iceCount + 1);
            const iceMaterial = GameManager.instance?.getMaterialByIndex(10);
            const bl = this.node.getChildByName('Block');
            if (bl) {
                const mr = bl.getComponent(MeshRenderer);
                if (mr) mr.material = iceMaterial;
            } else {
                const mr = this.node.getComponent(MeshRenderer);
                if (mr) mr.material = iceMaterial;
            }
            // const label = this.node.getChildByName('Label');
            // label.active = true;
        } else {
            this.setIceCount(1);
        }

        if (layerData && layerData.hasLayer == 1) {
            this.hasLayer = true;
            const layerMaterial = GameManager.instance?.getMaterialByIndex(
                layerData.blockType
            );
            if (layerMaterial) {
                const ll = this.node.getChildByName('Layer');
                if (ll) {
                    const mr = ll.getComponent(MeshRenderer);
                    if (mr) mr.material = layerMaterial;
                } else {
                    const mr = this.node.getComponent(MeshRenderer);
                    if (mr) mr.material = layerMaterial;
                }
            }
            this.setLayerColor(layerData.blockType);
        }

        if (joinedGroupData && joinedGroupData.isMemberOfJoinedGorup == 1) {
            this.groupIndex = joinedGroupData.groupIndex;
            for (const blockNode of GameManager.instance?.blockNode) {
                const block = blockNode.getComponent(BlockPrefab);
                if (block.groupIndex == this.groupIndex) {
                    this.connectedBlock = block.node;

                    this.addConnectedBlockColliders(this.connectedBlock);
                    // Disable collider gốc của connected block để tránh duplicate collision
                    this.setCollidersEnabled(this.connectedBlock, false);
                    const cloneConnected = instantiate(this.connectedBlock);
                    cloneConnected.name = 'ConnectedBlockClone';
                    cloneConnected.getComponent(RigidBody).enabled = false;
                    const pos = new Vec3();
                    this.node.inverseTransformPoint(
                        pos,
                        cloneConnected.getWorldPosition()
                    );
                    cloneConnected.setPosition(pos);
                    if (
                        this.node.eulerAngles.z == 90 ||
                        this.node.eulerAngles.z == 270
                    ) {
                        cloneConnected.eulerAngles = new Vec3(
                            cloneConnected.eulerAngles.x,
                            cloneConnected.eulerAngles.y + 180,
                            cloneConnected.eulerAngles.z + 90
                        );
                    } else {
                        cloneConnected.eulerAngles = new Vec3(
                            cloneConnected.eulerAngles.x,
                            cloneConnected.eulerAngles.y + 180,
                            cloneConnected.eulerAngles.z
                        );
                    }

                    this.node.addChild(cloneConnected);
                }
            }
        }

        this.checkLayer();

        if (isOneWayMovementActive && isOneWayMovementActive == 1) {
            {
                const a = this.node.getChildByName('Arrow' + wayDirection);
                if (a) a.active = true;
            }
        }

        // Set block type

        this.setIsOneWayMovementActive(isOneWayMovementActive);
        this.setWayDiretion(wayDirection);
        this.setBlockGroupType(blockGroupType);
    }

    setBlockRect(
        position: { x: number; y: number; z: number },
        rotation: { x: number; y: number; z: number },
        blockGroupType: number
    ) {
        if (blockGroupType == 0) {
            const width = GRID_SIZE;
            const height = GRID_SIZE;
            let x = Math.round(position.x * 2) / 2;
            let y = Math.round(position.y * 2) / 2;
            x -= width / 2;
            y -= height / 2;
            this.rect = new Rect(x, y, width, height);
        }
        if (blockGroupType == 1) {
            if (Math.round(rotation.z) == 0 || Math.round(rotation.z) == 180) {
                const width = GRID_SIZE;
                const height = GRID_SIZE * 2;
                let x = Math.round(position.x * 2) / 2;
                let y = Math.round(position.y * 2) / 2;
                x -= width / 2;
                y -= height / 2;
                this.rect = new Rect(x, y, width, height);
            } else {
                const width = GRID_SIZE * 2;
                const height = GRID_SIZE;
                let x = Math.round(position.x * 2) / 2;
                let y = Math.round(position.y * 2) / 2;
                x -= width / 2;
                y -= height / 2;
                this.rect = new Rect(x, y, width, height);
            }
        }
        if (blockGroupType == 2) {
            if (Math.round(rotation.z) == 0 || Math.round(rotation.z) == 180) {
                const width = GRID_SIZE;
                const height = GRID_SIZE * 3;
                let x = Math.round(position.x * 2) / 2;
                let y = Math.round(position.y * 2) / 2;
                x -= width / 2;
                y -= height / 2;
                this.rect = new Rect(x, y, width, height);
            } else {
                const width = GRID_SIZE * 3;
                const height = GRID_SIZE;
                let x = Math.round(position.x * 2) / 2;
                let y = Math.round(position.y * 2) / 2;
                x -= width / 2;
                y -= height / 2;
                this.rect = new Rect(x, y, width, height);
            }
        }
        if (
            blockGroupType == 3 ||
            blockGroupType == 4 ||
            blockGroupType == 11
        ) {
            if (Math.round(rotation.z) == 0 || Math.round(rotation.z) == 180) {
                const width = GRID_SIZE * 2;
                const height = GRID_SIZE * 3;
                let x = Math.round(position.x * 2) / 2;
                let y = Math.round(position.y * 2) / 2;
                x -= width / 2;
                y -= height / 2;
                this.rect = new Rect(x, y, width, height);
            } else {
                const width = GRID_SIZE * 3;
                const height = GRID_SIZE * 2;
                let x = Math.round(position.x * 2) / 2;
                let y = Math.round(position.y * 2) / 2;
                x -= width / 2;
                y -= height / 2;
                this.rect = new Rect(x, y, width, height);
            }
        }
        if (blockGroupType == 5 || blockGroupType == 7) {
            const width = GRID_SIZE * 2;
            const height = GRID_SIZE * 2;
            let x = Math.round(position.x * 2) / 2;
            let y = Math.round(position.y * 2) / 2;
            x -= width / 2;
            y -= height / 2;
            this.rect = new Rect(x, y, width, height);
        }
        if (blockGroupType == 6) {
            const width = GRID_SIZE * 3;
            const height = GRID_SIZE * 3;
            let x = Math.round(position.x * 2) / 2;
            let y = Math.round(position.y * 2) / 2;
            x -= width / 2;
            y -= height / 2;
            this.rect = new Rect(x, y, width, height);
        }
        if (
            blockGroupType == 8 ||
            blockGroupType == 9 ||
            blockGroupType == 10
        ) {
            if (Math.round(rotation.z) == 0 || Math.round(rotation.z) == 180) {
                const width = GRID_SIZE * 3;
                const height = GRID_SIZE * 2;
                let x = Math.round(position.x * 2) / 2;
                let y = Math.round(position.y * 2) / 2;
                x -= width / 2;
                y -= height / 2;
                this.rect = new Rect(x, y, width, height);
            } else {
                const width = GRID_SIZE * 2;
                const height = GRID_SIZE * 3;
                let x = Math.round(position.x * 2) / 2;
                let y = Math.round(position.y * 2) / 2;
                x -= width / 2;
                y -= height / 2;
                this.rect = new Rect(x, y, width, height);
            }
        }
    }

    // getCombinedAABB(): geometry.AABB | null {
    //     // Mỗi Collider riêng lẻ đều có worldBounds của nó. Để lấy AABB của node -> Merge các AABB của từng collider
    //     const colliders = this.node.getComponents(BoxCollider);
    //     console.log(colliders);
    //     if (colliders.length === 0) return null;

    //     // Clone AABB đầu tiên
    //     const totalAABB = colliders[0].worldBounds.clone();

    //     // Gộp dần các AABB khác
    //     for (let i = 1; i < colliders.length; i++) {
    //         geometry.AABB.merge(totalAABB, totalAABB, colliders[i].worldBounds);
    //     }

    //     return totalAABB;
    // }
}
