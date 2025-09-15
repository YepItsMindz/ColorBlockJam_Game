import { _decorator, Component, input, Input, EventMouse, Camera, geometry, PhysicsSystem, Node, PhysicsRayResult, PhysicsSystem2D, EPhysics2DDrawFlags } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MousePick3D')
export class MousePick3D extends Component {
    @property(Camera)
    camera: Camera = null!;   // Gán camera trong Inspector

    private isHovering: boolean = false;

    start() {
        PhysicsSystem2D.instance.debugDrawFlags =
            EPhysics2DDrawFlags.Aabb |
            EPhysics2DDrawFlags.Pair |
            EPhysics2DDrawFlags.CenterOfMass |
            EPhysics2DDrawFlags.Shape |
            EPhysics2DDrawFlags.Joint;
         PhysicsSystem.instance.debugDrawFlags = 1;
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
    }

    onMouseMove(event: EventMouse) {
        console.log("isWorking")
        const screenPos = event.getLocation();

        // Tạo ray từ camera ra thế giới
        const ray = new geometry.Ray();
        this.camera.screenPointToRay(screenPos.x, screenPos.y, ray);

        // Raycast tất cả collider
        if (PhysicsSystem.instance.raycast(ray)) {
            const results: PhysicsRayResult[] = PhysicsSystem.instance.raycastResults;
            
            // Kiểm tra xem có collider nào là của node này không
            const hit = results.find(r => r.collider.node === this.node);

            if (hit) {
                if (!this.isHovering) {
                    this.isHovering = true;
                    console.log("Mouse ENTER 3D object:", this.node.name);
                }
            } else {
                if (this.isHovering) {
                    this.isHovering = false;
                    console.log("Mouse LEAVE 3D object:", this.node.name);
                }
            }
        } else {
            if (this.isHovering) {
                this.isHovering = false;
                console.log("Mouse LEAVE 3D object:", this.node.name);
            }
        }
    }
}
