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
} from 'cc';
import { ColorType } from '../GameConstant';
import { GatePrefab } from './GatePrefab';
const { ccclass, property } = _decorator;

@ccclass('BlockPrefab')
export class BlockPrefab extends Component {
    public color: ColorType;
    public blockGroupType: number = null;
    public hasPassedThroughGate: boolean = false;

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

    onCollisionEnter(event: ICollisionEvent) {
        const gateCmp = event.otherCollider.node.getComponent(GatePrefab);
        if (gateCmp) {
            console.log(
                `Gate color: ${ColorType[gateCmp.color]}, Block color: ${ColorType[this.color]}`
            );

            // Kiểm tra nếu màu giống nhau
            if (gateCmp.color === this.color) {
                this.passThroughGate(gateCmp.node, gateCmp);
            }
        }
    }

    onCollisionStay(event: ICollisionEvent) {
        //console.log('Đang va chạm với', event.otherCollider.node.name);
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
        blockGroupType: number,
        blockType: ColorType,
        material: Material | null
    ) {
        // Set position
        this.node.setPosition(position.x, position.y, position.z);

        // Set rotation
        this.node.setRotationFromEuler(
            rotation.x,
            rotation.y + 180,
            rotation.z
        );

        // Set material
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

        // Set block type
        this.setBlockGroupType(blockGroupType);
        this.setColorType(blockType);
    }

    passThroughGate(gateNode: Node, gatePrefab: GatePrefab) {
        console.log('Block is passing through gate!');

        // Lấy vị trí hiện tại của block và gate
        const blockPos = this.node.getWorldPosition();
        const gatePos = gateNode.getWorldPosition();

        // Sử dụng thuộc tính doorDir từ GatePrefab để xác định hướng
        const gateDir = gatePrefab.doorDir;

        // Tính vector từ gate đến block
        const offset = new Vec3();
        Vec3.subtract(offset, blockPos, gatePos);

        // Xác định hướng di chuyển dựa trên dir
        let targetPos = new Vec3();

        if (gateDir === 1) {
            // dir = 1: đối xứng theo trục Y (di chuyển dọc)
            console.log('Gate dir = 1, mirroring across Y axis');
            targetPos.set(
                blockPos.x,
                gatePos.y + (gatePos.y - blockPos.y), // Đối xứng qua trục Y
                blockPos.z
            );
        } else {
            // dir = 0: đối xứng theo trục X (di chuyển ngang)
            console.log('Gate dir = 0, mirroring across X axis');
            targetPos.set(
                gatePos.x + (gatePos.x - blockPos.x), // Đối xứng qua trục X
                blockPos.y,
                blockPos.z
            );
        }

        // Đảm bảo vị trí đích hợp lý (cách gate ít nhất 2 units)
        const minDistance = 2;
        const distanceToGate = Vec3.distance(targetPos, gatePos);
        if (distanceToGate < minDistance) {
            const direction = new Vec3();
            Vec3.subtract(direction, targetPos, gatePos);
            direction.normalize();
            Vec3.multiplyScalar(direction, direction, minDistance);
            Vec3.add(targetPos, gatePos, direction);
        }

        // Đánh dấu block đã đi qua cổng
        this.hasPassedThroughGate = true;

        this.setCollidersEnabled(this.node, false);
        // Tạo tween animation để di chuyển block
        tween(this.node)
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
                this.node.getComponent(RigidBody).linearFactor = new Vec3(
                    0,
                    0,
                    0
                );
                this.node.getComponent(RigidBody).setLinearVelocity(Vec3.ZERO);
                this.node.getComponent(RigidBody).setAngularVelocity(Vec3.ZERO);
                console.log(
                    'Block has passed through the gate and can no longer be moved!'
                );
            })
            .start();
    }
}
