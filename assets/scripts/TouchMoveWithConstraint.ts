import { _decorator, Component, input, Input, EventTouch, RigidBody, Vec3, ConfigurableConstraint, EventMouse } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('TouchMoveWithConstraint')
export class TouchMoveWithConstraint extends Component {
    @property
    speed: number = 5;

    private rb: RigidBody | null = null;
    private moveDir: Vec3 = new Vec3();
    private touchStartPos: Vec3 = new Vec3();

    start() {
        this.rb = this.getComponent(RigidBody);
        if (this.rb) {
            // Ensure no rotation by zeroing angular velocity and, if available, setting angular factor
            try {
                this.rb.setAngularVelocity && this.rb.setAngularVelocity(new Vec3(0, 0, 0));
                // Some engine versions support angularFactor or similar property in native body data
                if ((this.rb as any).angularFactor) {
                    (this.rb as any).angularFactor = { x: 0, y: 0, z: 0 };
                }
            } catch (e) {
                // ignore
            }
        }

            const constraint = this.getComponent(ConfigurableConstraint) as any;
            if (constraint) {
                // Configure constraint to allow movement only on XZ and lock rotation.
                // Use any-casts because engine typings may differ between versions.
                try {
                    if (constraint.linearLimit) {
                        // Motion enums can be different across engine versions; try common names
                        const MotionMode = (ConfigurableConstraint as any).MotionMode || (constraint as any).MotionMode || { LIMITED: 1, LOCKED: 0 };
                        // Allow movement on X and Y (horizontal and vertical), lock Z to keep object in plane
                        constraint.linearLimit.xMotion = MotionMode.LIMITED;
                        constraint.linearLimit.yMotion = MotionMode.LIMITED;
                        constraint.linearLimit.zMotion = MotionMode.LOCKED;
                    }

                    if (constraint.angularLimit) {
                        const MotionMode = (ConfigurableConstraint as any).MotionMode || (constraint as any).MotionMode || { LIMITED: 1, LOCKED: 0 };
                        // Lock all rotations
                        constraint.angularLimit.xMotion = MotionMode.LOCKED;
                        constraint.angularLimit.yMotion = MotionMode.LOCKED;
                        constraint.angularLimit.zMotion = MotionMode.LOCKED;
                    }
                } catch (e) {
                    // If runtime API differs, skip constraint setup to avoid crashes in editor.
                    // tslint:disable-next-line:no-console
                    console.warn('Could not configure ConfigurableConstraint on node:', this.node.name, e);
                }
            }

        // Bắt sự kiện touch
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    update(deltaTime: number) {
        // Prevent rotation: ensure angular velocity is zero
        if (this.rb) {
            try {
                this.rb.setAngularVelocity && this.rb.setAngularVelocity(new Vec3(0, 0, 0));
            } catch (e) {
                // ignore
            }
        }
        if (this.rb && !this.moveDir.equals(Vec3.ZERO)) {
            // moveDir.x maps to world X, moveDir.y maps to world Y (vertical)
            const velocity = new Vec3(
                this.moveDir.x * this.speed,
                this.moveDir.y * this.speed,
                0
            );
            this.rb.applyForce(velocity);
        }
    }

    private onTouchStart(event: EventTouch | EventMouse) {
        const loc = event.getLocation();
        this.touchStartPos.set(loc.x, loc.y, 0);
    }

    private onTouchMove(event: EventTouch | EventMouse) {
        const loc = event.getLocation();
        // Map drag X to world X and drag Y (screen Y) to world Y
        const dx = loc.x - this.touchStartPos.x;
        const dy = loc.y - this.touchStartPos.y;
        const dir = new Vec3(dx, dy, 0);

        if (dir.length() > 0) {
            dir.normalize();
            this.moveDir.set(dir.x, dir.y, 0);
        }
    }

    private onTouchEnd(event: EventTouch | EventMouse) {
        this.moveDir.set(0, 0, 0);
    }
}
