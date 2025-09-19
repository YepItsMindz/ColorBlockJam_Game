import { _decorator, Component, Camera, input, Input, EventMouse, PhysicsSystem, Vec3, RigidBody, ERigidBodyType } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MouseJoint3D')
export class MouseJoint3D extends Component {

    @property(Camera)
    camera: Camera = null!;

    @property
    speed : number = 0;

    @property
    stiffness : number = 0;

    @property 
    damping : number = 0;

    private selectedBody: RigidBody | null = null;
    private selectedNode: any = null;
    private fixedZ = 0;
    private offset: Vec3 = new Vec3();
    private targetPos: Vec3 | null = null;

    start() {
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }

    onMouseDown(event: EventMouse) {
        
        const ray = this.camera.screenPointToRay(event.getLocationX(), event.getLocationY());
        if (PhysicsSystem.instance.raycastClosest(ray)) {
            const hit = PhysicsSystem.instance.raycastClosestResult;
            this.selectedBody = hit.collider.getComponent(RigidBody);
            if (!this.selectedBody) return;

            if (this.selectedBody && this.selectedBody.group === 4) {
                this.selectedBody = null; // nhóm Obstacle, không cho kéo
                return;
            }

            if (this.selectedBody) {
                this.selectedBody.type = ERigidBodyType.DYNAMIC;
                this.selectedBody.useGravity = false;
                this.selectedBody.angularFactor = new Vec3(0, 0, 0);
            }

            this.selectedNode = hit.collider.node;
            this.fixedZ = this.selectedNode.worldPosition.z;

            // offset từ hitpoint tới tâm node
            this.offset.set(
                hit.hitPoint.x - this.selectedNode.worldPosition.x,
                hit.hitPoint.y - this.selectedNode.worldPosition.y,
                0
            );

            this.targetPos = new Vec3(this.selectedNode.worldPosition);
        }
    }

    onMouseMove(event: EventMouse) {
        if (!this.selectedNode || !this.selectedBody) return;

        const ray = this.camera.screenPointToRay(event.getLocationX(), event.getLocationY());
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

        const currentPos = this.selectedBody.node.worldPosition;
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
            this.selectedBody.setLinearVelocity(Vec3.ZERO);
            this.selectedBody.setAngularVelocity(Vec3.ZERO);
            this.selectedBody.type = ERigidBodyType.STATIC;
            this.selectedBody = null;
        }
        this.selectedNode = null;
        this.targetPos = null;
    }
}
