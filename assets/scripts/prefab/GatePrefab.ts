import {
    _decorator,
    Collider,
    Component,
    ICollisionEvent,
    Material,
    MeshRenderer,
    Node,
} from 'cc';
import { ColorType } from '../GameConstant';
const { ccclass, property } = _decorator;

@ccclass('GatePrefab')
export class GatePrefab extends Component {
    public color: ColorType;
    public doorPartCount: number = null;
    public doorDir: number = null; //0 = vertical; 1 = horizontal

    setColorType(color: ColorType) {
        this.color = color;
    }

    setDoorPartCount(index: number) {
        this.doorPartCount = index;
    }

    setDoorDir(index: number) {}

    start() {
        // const colliders = this.getComponents(Collider);
        // for (const c of colliders) {
        //     c.on('onCollisionEnter', this.onCollisionEnter, this);
        //     c.on('onCollisionStay', this.onCollisionStay, this);
        //     c.on('onCollisionExit', this.onCollisionExit, this);
        // }
    }

    // onCollisionEnter(event: ICollisionEvent) {
    //     console.log('Bắt đầu va chạm với', event.otherCollider.node.name);
    // }

    // onCollisionStay(event: ICollisionEvent) {
    //     console.log('Đang va chạm với', event.otherCollider.node.name);
    // }

    // onCollisionExit(event: ICollisionEvent) {
    //     console.log('Kết thúc va chạm với', event.otherCollider.node.name);
    // }

    // setCollidersEnabled(node: Node, enabled: boolean) {
    //     const colliders = node.getComponents(Collider);
    //     for (const c of colliders) {
    //         c.enabled = enabled;
    //     }
    // }

    initializeBlock(
        position: { x: number; y: number; z: number },
        rotation: { x: number; y: number; z: number },
        doorPartCount: number,
        blockType: number,
        material: Material | null
    ) {
        // Set position
        this.node.setPosition(position.x, position.y, position.z);
        // Set rotation
        if (Math.round(rotation.z) == 90 || Math.round(rotation.z) == 270)
            this.doorDir = 0;
        else this.doorDir = 1;

        this.node.setRotationFromEuler(
            rotation.x,
            rotation.y + 180,
            rotation.z
        );

        // Set material
        const child = this.node.getChildByName('Block');
        const childUnder = this.node.getChildByName('Block_Under');

        let mr = child.getComponent(MeshRenderer);
        if (mr && material) mr.material = material;

        mr = childUnder.getComponent(MeshRenderer);
        if (mr && material) mr.material = material;

        this.setDoorPartCount(doorPartCount);
        this.setColorType(blockType);
    }
}
