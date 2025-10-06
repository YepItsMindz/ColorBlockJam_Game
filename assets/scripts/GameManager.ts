import {
    _decorator,
    Component,
    EditBox,
    EventKeyboard,
    Input,
    KeyCode,
    input,
    instantiate,
    JsonAsset,
    Material,
    MeshRenderer,
    Node,
    PhysicsSystem,
    Prefab,
    resources,
} from 'cc';
import { BlockPrefab } from './prefab/BlockPrefab';
import { GatePrefab } from './prefab/GatePrefab';
const { ccclass, property } = _decorator;

export const GRID_SIZE = 2;

@ccclass('GameManager')
export class GameManager extends Component {
    public static instance: GameManager = null;

    @property([Prefab])
    BlockGroup: Prefab[] = [];

    @property([Prefab])
    Blockades: Prefab[] = [];

    @property([Prefab])
    Door: Prefab[] = [];

    @property(Prefab)
    Grid: Prefab = null;

    @property([Material])
    Materials: Material[] = [];

    @property(EditBox)
    Edit: EditBox = null;

    public gridSize: { x: number; y: number } = null;
    public gateNode: Node[] = [];
    public blockNode: Node[] = [];
    public blockadeNode: Node[] = []; // Track blockades để có thể xóa
    public currentLevel: number = 1;
    private isLevelCompleted: boolean = false;

    start() {
        GameManager.instance = this;
        this.loadLevel(8);
        if (this.Edit) {
            this.Edit.node.on('editing-return', this.loadLevelFromEdit, this);
        }
    }

    loadLevelFromEdit() {
        if (!this.Edit) return;

        const text = this.Edit.string ? this.Edit.string.trim() : '';
        const n = Number(text);
        if (!Number.isFinite(n) || n <= 0) {
            console.warn(`Invalid level number: '${text}'`);
            return;
        }

        const children = this.node.children.slice();
        for (const child of children) {
            if (child === this.node) continue;
            const editBoxComponent = child.getComponentInChildren
                ? child.getComponentInChildren(EditBox)
                : null;
            if (editBoxComponent) continue;

            child.removeFromParent();
            child.destroy();
        }

        this.loadLevel(Math.round(n));
    }

    instantiateAndSetup(
        pf: Prefab | null,
        position: { x: number; y: number; z: number },
        rotation: { x: number; y: number; z: number },
        scale?: { x: number; y: number; z: number }
    ): Node | null {
        if (!pf) return null;
        const node = instantiate(pf);
        node.setPosition(position.x, position.y, position.z);
        node.setRotationFromEuler(rotation.x, rotation.y + 180, rotation.z);
        if (scale) node.setScale(scale.x, scale.y, scale.z);
        this.node.addChild(node);
        return node;
    }

    getBlockGroupByIndex(index: number): Prefab | null {
        if (index >= 0 && index < this.BlockGroup.length) {
            return this.BlockGroup[index];
        }
        return null;
    }

    getBlockadesByIndex(index: number): Prefab | null {
        if (index >= 0 && index < this.Blockades.length) {
            return this.Blockades[index];
        }
        return null;
    }

    getDoorByIndex(index: number): Prefab | null {
        if (index >= 0 && index < this.Door.length) {
            return this.Door[index];
        }
        return null;
    }

    getMaterialByIndex(index: number): Material | null {
        if (index >= 0 && index < this.Materials.length) {
            return this.Materials[index];
        }
        return null;
    }

    loadLevel(index: number) {
        this.currentLevel = index;
        this.isLevelCompleted = false;
        this.gateNode.length = 0;
        this.blockNode.length = 0;
        this.blockadeNode.length = 0;
        const name = `Level ${index}`;
        resources.load(`level/${name}`, (err: Error, jsonAsset: JsonAsset) => {
            if (!err) {
                let clone = JSON.parse(JSON.stringify(jsonAsset.json));
                let map = clone.levelBlockGroupsData.blockGroupDatas;
                map.forEach((block) => {
                    const pf = this.getBlockGroupByIndex(block.blockGroupType);
                    if (!pf) return;

                    const legoClone = instantiate(pf);
                    if (
                        block.blockGroupType === 5 ||
                        block.blockGroupType === 11
                    ) {
                        block.rotation.y += 180;
                    }
                    legoClone
                        .getComponent(BlockPrefab)
                        .initializeBlock(
                            block.position,
                            block.rotation,
                            block.layerData,
                            block.isOneWayMovementActive,
                            block.wayDirection,
                            block.blockGroupLevelElementData,
                            block.joinedGroupData,
                            block.blockGroupType,
                            block.blockType
                        );
                    this.blockNode.push(legoClone);
                    this.node.addChild(legoClone);
                });

                map = clone.levelBlockadesData.blockades;
                map.forEach((blockades) => {
                    const pf = this.getBlockadesByIndex(blockades.blockType);
                    if (!pf) return;

                    if (blockades.rotation.x < 90) {
                        blockades.rotation.z += 180;
                        blockades.rotation.x += 180;
                    }

                    const blockadeNode = this.instantiateAndSetup(
                        pf,
                        blockades.position,
                        blockades.rotation,
                        blockades.scale
                    );

                    if (blockadeNode) {
                        this.blockadeNode.push(blockadeNode);
                    }
                });

                map = clone.levelDoorsData.doors;
                map.forEach((door) => {
                    const pf = this.getDoorByIndex(door.doorPartCount);
                    if (!pf) return;

                    const gate = instantiate(pf);
                    if (
                        Math.round(door.rotation.z) === 90 ||
                        Math.round(door.rotation.z) === 270
                    ) {
                        door.rotation.z += 180;
                    }
                    gate.getComponent(GatePrefab).initializeBlock(
                        door.position,
                        door.rotation,
                        door.doorPartCount,
                        door.blockType
                    );
                    this.gateNode.push(gate);
                    this.node.addChild(gate);
                });

                this.gridSize = clone.gridSize;
                this.createMapFromGrid(clone.gridSize, clone.hidedGridCoords);
            }
        });
    }

    createMapFromGrid(
        grid: { x: number; y: number },
        hidedCoords?: Array<{ x: number; y: number }>
    ) {
        const cols = (grid.x - 1) / 2;
        const rows = (grid.y - 1) / 2;
        const size = GRID_SIZE;
        for (let i = 0; i < grid.x; i++) {
            for (let j = 0; j < grid.y; j++) {
                const hide = hidedCoords.some((c) => c.x === i && c.y === j);
                if (hide) continue;

                const node = instantiate(this.Grid);
                node.setPosition((i - cols) * size, (j - rows) * size, 0);
                this.node.addChild(node);
            }
        }
    }

    // Kiểm tra xem tất cả các khối có đã đi qua cổng chưa
    checkAllBlocksPassedGate(): boolean {
        if (this.blockNode.length === 0) return false;

        for (const blockNode of this.blockNode) {
            const blockPrefab = blockNode.getComponent(BlockPrefab);
            if (!blockPrefab || !blockPrefab.hasPassedThroughGate) {
                return false;
            }
        }
        return true;
    }

    // Chuyển sang level tiếp theo
    nextLevel() {
        console.log(
            `Level ${this.currentLevel} completed! Loading next level...`
        );

        this.clearCurrentLevel();
        this.loadLevel(this.currentLevel + 1);
    }

    // Xóa tất cả nodes của level hiện tại
    clearCurrentLevel() {
        // Xóa tất cả block nodes
        this.blockNode.forEach((node) => {
            if (node && node.isValid) {
                node.destroy();
            }
        });

        // Xóa tất cả gate nodes
        this.gateNode.forEach((node) => {
            if (node && node.isValid) {
                node.destroy();
            }
        });

        // Xóa tất cả blockade nodes
        this.blockadeNode.forEach((node) => {
            if (node && node.isValid) {
                node.destroy();
            }
        });

        // Xóa tất cả grid nodes
        const children = this.node.children.slice();
        children.forEach((child) => {
            if (child.name.includes('Grid')) {
                child.destroy();
            }
        });

        // Reset arrays
        this.blockNode.length = 0;
        this.gateNode.length = 0;
        this.blockadeNode.length = 0;
    }

    update(deltaTime: number) {
        // Kiểm tra xem tất cả các khối có đã đi qua cổng chưa
        if (!this.isLevelCompleted && this.checkAllBlocksPassedGate()) {
            this.isLevelCompleted = true;
            console.log(
                `All blocks have passed through gates! Level ${this.currentLevel} completed!`
            );

            // Delay một chút trước khi chuyển level để người chơi thấy được kết quả
            this.scheduleOnce(() => {
                this.nextLevel();
            }, 0.5);
        }
    }
}
