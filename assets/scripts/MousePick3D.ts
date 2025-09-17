import { _decorator, Component, Camera, input, Input, EventMouse, PhysicsSystem, Vec3, geometry, RigidBody } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MouseJoint3D')
export class MouseJoint3D extends Component {

    @property(Camera)
    camera: Camera = null!;

    private selectedBody: RigidBody | null = null;
    private selectedNode: any = null;
    private fixedZ = 0;
    private offset: Vec3 = new Vec3();

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
            console.log('MouseDown picked:', hit.collider && hit.collider.node ? hit.collider.node.name : hit.collider, this.selectedBody ? 'rigidbody attached' : 'no rigidbody');
            
            this.selectedNode = hit.collider.node;
            this.fixedZ = this.selectedNode.worldPosition.z;
             this.offset.set(
                hit.hitPoint.x - this.selectedNode.worldPosition.x,
                hit.hitPoint.y - this.selectedNode.worldPosition.y,
                0
            );
            
        }
    }

    onMouseMove(event: EventMouse) {
        if (!this.selectedNode) return;

        const ray = this.camera.screenPointToRay(event.getLocationX(), event.getLocationY());

        // Giao ray với mặt phẳng z = fixedZ
        const t = (this.fixedZ - ray.o.z) / ray.d.z;
        if (t > 0) {
            const hitPoint = new Vec3(
                ray.o.x + ray.d.x * t,
                ray.o.y + ray.d.y * t,
                this.fixedZ
            );
            console.log(hitPoint);
            const newPos = new Vec3();
            Vec3.subtract(newPos, hitPoint, this.offset);
            this.selectedNode.setWorldPosition(newPos);
        }
    }

    onMouseUp() {
        console.log('MouseUp - clearing selection', this.selectedBody ? this.selectedBody.node.name : '(none)');
        this.selectedNode = null;
    }
}
