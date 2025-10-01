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
    public rect: Rect;

    setLayerColor(color: ColorType) {
        this.layerColor = color;
    }

    setColorType(color: ColorType) {
        this.color = color;
    }

    setBlockGroupType(index: number) {
        this.blockGroupType = index;
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

    initializeBlock(
        position: { x: number; y: number; z: number },
        rotation: { x: number; y: number; z: number },
        layerData: { hasLayer: number; layerBlockType: number },
        blockGroupType: number,
        blockType: ColorType
    ) {
        this.setBlockRect(position, rotation, blockGroupType);
        // Set position

        this.node.setPosition(position.x, position.y, position.z);

        // Set rotation
        this.node.setRotationFromEuler(
            rotation.x,
            rotation.y + 180,
            rotation.z
        );

        // Set material - tự lấy từ GameManager
        const material = GameManager.instance?.getMaterialByIndex(blockType);
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

        if (layerData.hasLayer == 1) {
            console.log('YES');
            this.hasLayer = true;
            const layerMaterial = GameManager.instance?.getMaterialByIndex(
                layerData.layerBlockType
            );
            if (layerMaterial) {
                const ll = this.node.getChildByName('Layer');
                if (ll) {
                    ll.active = true;
                    const mr = ll.getComponent(MeshRenderer);
                    if (mr) mr.material = layerMaterial;
                } else {
                    const mr = this.node.getComponent(MeshRenderer);
                    if (mr) mr.material = layerMaterial;
                }
            }
        }

        // Set block type

        this.setBlockGroupType(blockGroupType);
        this.setColorType(blockType);
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
                console.log(x, y, width, height);
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
