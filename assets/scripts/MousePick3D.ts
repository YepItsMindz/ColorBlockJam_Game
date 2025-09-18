import { _decorator, Component, Camera, input, Input, EventMouse, PhysicsSystem, Vec3, geometry, RigidBody, EventTouch, v3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MouseJoint3D')
export class MouseJoint3D extends Component {
    @property(Camera)
    camera: Camera = null!;

    @property
    frequencyHz: number = 5;

    @property
    stiffness: number = 10;
    
    @property
    damping: number = 1;


    private selectedBody: RigidBody | null = null;
    private targetPos: Vec3 = new Vec3();
    private canDrag: boolean = true;


    start() {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchUp, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);

    }

    onTouchStart(event: EventTouch | EventMouse) {
        const ray = this.camera.screenPointToRay(event.getLocationX(), event.getLocationY());
        if (PhysicsSystem.instance.raycastClosest(ray)) {
            const hit = PhysicsSystem.instance.raycastClosestResult;
            this.selectedBody = hit.collider.getComponent(RigidBody);
            this.selectedBody.setAngularVelocity(new Vec3());
            this.selectedBody.type = RigidBody.Type.DYNAMIC;
            this.selectedBody.useGravity = false;
            console.log('MouseDown picked:', hit.collider && hit.collider.node ? hit.collider.node.name : hit.collider, this.selectedBody ? 'rigidbody attached' : 'no rigidbody');
        }
    }

    onTouchMove(event: EventTouch | EventMouse) {
        if (!this.canDrag || !this.selectedBody) return;

        const screenPos = event.getUILocation();
        const worldPos = screenPos;//this.camera.screenToWorld(new Vec3(screenPos.x, screenPos.y, 0));
        this.updateTargetPos(new Vec3(worldPos.x, worldPos.y));
    }

    updateTargetPos(world: Vec3) {
        //const current = this.selectedBody!.node.worldPosition;
        this.targetPos.set(world.x, world.y);
    }

    onTouchUp() {
        this.selectedBody = null;
    }

    onTouchCancel() {
    }

    update(dt: number) {
        if (!this.canDrag || !this.selectedBody) return;
        

        const bodyPos = this.selectedBody.node.worldPosition;
        const posA = new Vec3(bodyPos.x, bodyPos.y);
        const forceDir = this.targetPos.clone().subtract(posA);

        const distance = forceDir.length();
        if (distance < 5) {
            this.selectedBody.setLinearVelocity(new Vec3(0,0,0));
            this.selectedBody.node.setWorldPosition(this.targetPos.x, this.targetPos.y, 0);
        } else {
            forceDir.normalize();
            let velocity = new Vec3(0,0,0);
            this.selectedBody.getLinearVelocity(velocity);
            // const dampingForce = velocity.multiplyScalar(this.damping);
            // const springForce = forceDir.multiplyScalar(this.stiffness * distance).subtract(dampingForce);

            // Mass of body
            const mass = this.selectedBody.mass;
            // Angular frequency
            const omega = 2 * Math.PI * this.frequencyHz;
            // Effective stiffness and damping
            const stiffness = mass * omega * omega;
            const damping = 2 * mass * this.damping * omega;
            const dampingForce = velocity.multiplyScalar(damping)
            const springForce = forceDir.multiplyScalar(stiffness).subtract(dampingForce);

            this.selectedBody.applyForce(springForce);
        }

    }
}
