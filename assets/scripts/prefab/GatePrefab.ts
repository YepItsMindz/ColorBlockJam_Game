import {
    _decorator,
    BoxCollider,
    Collider,
    Component,
    geometry,
    ICollisionEvent,
    Material,
    MeshRenderer,
    Node,
    Rect,
} from 'cc';
import { ColorType } from '../GameConstant';
import { GRID_SIZE, GameManager } from '../GameManager';
const { ccclass, property } = _decorator;

@ccclass('GatePrefab')
export class GatePrefab extends Component {
    public color: ColorType;
    public doorPartCount: number = null;
    public doorDir: number = null; //0 = vertical; 1 = horizontal
    public rect: Rect;

    setColorType(color: ColorType) {
        this.color = color;
    }

    setDoorPartCount(index: number) {
        this.doorPartCount = index;
    }

    getCombinedAABB(): geometry.AABB {
        const collider = this.node.getComponent(BoxCollider);
        return collider.worldBounds as geometry.AABB;
    }

    initializeBlock(
        position: { x: number; y: number; z: number },
        rotation: { x: number; y: number; z: number },
        doorPartCount: number,
        blockType: number
    ) {
        // Set position
        this.node.setPosition(position.x, position.y, position.z);
        // Set rotation
        if (Math.round(rotation.z) == 450 || Math.round(rotation.z) == 270)
            this.doorDir = 0;
        else this.doorDir = 1;

        this.node.setRotationFromEuler(
            rotation.x,
            rotation.y + 180,
            rotation.z
        );

        // Set material - tự lấy từ GameManager
        const material = GameManager.instance?.getMaterialByIndex(blockType);
        const child = this.node.getChildByName('Block');
        const childUnder = this.node.getChildByName('Block_Under');

        let mr = child.getComponent(MeshRenderer);
        if (mr && material) mr.material = material;

        mr = childUnder.getComponent(MeshRenderer);
        if (mr && material) mr.material = material;

        this.setGateRect(position, doorPartCount);
        this.setDoorPartCount(doorPartCount);
        this.setColorType(blockType);
    }

    setGateRect(
        position: { x: number; y: number; z: number },
        doorPartCount: number
    ) {
        let rect: Rect;
        if (this.doorDir == 1) {
            const width = doorPartCount * GRID_SIZE;
            const height = GRID_SIZE;
            let x = Math.round(position.x * 2) / 2;
            let y = Math.round(position.y * 2) / 2;
            x -= width / 2;
            y -= height / 2;
            rect = new Rect(x, y, width, height);
        } else {
            // Provide a default value for rect in the else block
            const width = GRID_SIZE;
            const height = doorPartCount * GRID_SIZE;
            let x = Math.round(position.x * 2) / 2;
            let y = Math.round(position.y * 2) / 2;
            x -= width / 2;
            y -= height / 2;
            rect = new Rect(x, y, width, height);
        }
        this.rect = rect;
    }
}
