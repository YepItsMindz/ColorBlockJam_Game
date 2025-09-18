import { _decorator, Component, input, Input, EventTouch, Vec3, Vec2 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Character')
export class Character extends Component {
    @property
    speed: number = 5;

    private moveDir: Vec3 = new Vec3();
    private touchStartPos: Vec2 = new Vec2();

    start() {
        // Bắt sự kiện chạm
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    update(deltaTime: number) {
        if (!this.moveDir.equals(Vec3.ZERO)) {
            const pos = this.node.getPosition();
            const move = new Vec3(
                this.moveDir.x * this.speed * deltaTime,
                0,
                this.moveDir.z * this.speed * deltaTime
            );
            this.node.setPosition(pos.add(move));
        }
    }

    private onTouchStart(event: EventTouch) {
        event.getStartLocation(this.touchStartPos); // Lưu vị trí bắt đầu chạm
    }

    private onTouchMove(event: EventTouch) {
        const current = event.getLocation();
        const dir = new Vec2(current.x - this.touchStartPos.x, current.y - this.touchStartPos.y);

        // Chuẩn hóa thành hướng di chuyển (x,y)
        if (dir.length() > 0) {
            dir.normalize();
            this.moveDir.set(dir.x, 0, dir.y); // map (x,y) sang (x,z)
        }
    }

    private onTouchEnd(event: EventTouch) {
        this.moveDir.set(0, 0, 0); // Dừng lại khi thả tay
    }
}
