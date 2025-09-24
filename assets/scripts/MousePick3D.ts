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
} from 'cc';
import { GameManager } from './GameManager';
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
            if (!this.selectedBody) return;

            if (
                this.selectedBody.group === 4 ||
                this.selectedBody.group === 1
            ) {
                this.selectedBody = null; // nhóm Obstacle, Gate không cho kéo
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

            this.targetPos = new Vec3(this.selectedNode.worldPosition);
        }
    }

    onMouseMove(event: EventMouse) {
        if (!this.selectedNode || !this.selectedBody) return;

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
            this.selectedBody.linearFactor = new Vec3(0, 0, 0);
            this.selectedBody.setLinearVelocity(Vec3.ZERO);
            this.selectedBody.setAngularVelocity(Vec3.ZERO);
            // this.selectedBody.type = ERigidBodyType.STATIC;
        }
        this.selectedNode = null;
        this.selectedBody = null;
        this.targetPos = null;
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

        if (blockType == 'Three') {
            if (w % 2 === 0) {
                if (gx * GRID_SIZE > worldPos.x) gx -= 0.5;
                else gx += 0.5;
            }

            if (h % 2 === 0) {
                if (gy * GRID_SIZE > worldPos.y) gy -= 0.5;
                else gy += 0.5;
            }
        }

        if (blockType == 'L') {
            if (block.eulerAngles.z < 45) {
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

        if (blockType == 'Two') {
            if (block.eulerAngles.z < 45) {
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
}
