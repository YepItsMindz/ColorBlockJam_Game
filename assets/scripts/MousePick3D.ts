import { _decorator, Component, input, Input, EventMouse, Camera, Vec2, Vec3, PhysicsSystem2D, Graphics, Color, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MousePick2DPlane')
export class MousePick2DPlane extends Component {
    @property(Camera)
    camera: Camera = null!;   // Camera 3D trong scene

    @property(Graphics)
    gfx: Graphics = null!;    // Graphics node trong Canvas

    private hoveringNode: Node | null = null;

    start() {
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
    }

    onMouseMove(event: EventMouse) {
        // 1. Lấy tọa độ chuột màn hình
        const screenPos = event.getLocation();
        console.log(screenPos)

        // 2. Chuyển sang world (z = 0 để chiếu xuống mặt phẳng XY)
        const worldPos = this.camera.screenToWorld(new Vec3(screenPos.x, screenPos.y, 0));

        // 3. Tạo ray vuông góc XY (song song trục Z)
        const start2D = new Vec2(worldPos.x, worldPos.y);
        const end2D   = new Vec2(worldPos.x, worldPos.y); // x,y giữ nguyên → thẳng Z

        // 4. Raycast 2D
        const results = PhysicsSystem2D.instance.raycast(start2D, end2D);

        // 5. Vẽ debug
        this.gfx.clear();
        this.gfx.fillColor = Color.YELLOW;
        this.gfx.circle(start2D.x, start2D.y, 6);
        this.gfx.fill();

        if (results.length > 0) {
            const hitNode = results[0].collider.node;

            if (this.hoveringNode !== hitNode) {
                if (this.hoveringNode) {
                    console.log("Mouse LEAVE:", this.hoveringNode.name);
                }
                this.hoveringNode = hitNode;
                console.log("Mouse ENTER:", hitNode.name);
            }
        } else {
            if (this.hoveringNode) {
                console.log("Mouse LEAVE:", this.hoveringNode.name);
                this.hoveringNode = null;
            }
        }
    }
}
