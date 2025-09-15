import {
    _decorator,
    Component,
    instantiate,
    JsonAsset,
    Node,
    PhysicsSystem,
    Prefab,
    resources,
} from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {
    @property([Prefab])
    BlockGroup: Prefab[] = [];

    @property([Prefab])
    Blockades: Prefab[] = [];

    @property([Prefab])
    Door: Prefab[] = [];

    @property(Prefab)
    Grid: Prefab = null;

    start() {
        this.loadLevel(3);
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

    loadLevel(index: number) {
        const name = `Level ${index}`;
        resources.load(`level/${name}`, (err: Error, jsonAsset: JsonAsset) => {
            if (!err) {
                let map = jsonAsset.json;
                map = jsonAsset.json.levelBlockGroupsData.blockGroupDatas;
                map.forEach((block) => {
                    const pf = this.getBlockGroupByIndex(block.blockGroupType);
                    if (!pf) return;

                    const legoClone = instantiate(pf);
                    legoClone.setPosition(block.position.x, block.position.y, block.position.z);
                    const bl = legoClone.getChildByName('Block');
                    if (block.blockGroupType === 5 || block.blockGroupType === 11) {
                        block.rotation.y += 180;
                    }
                    if (bl) {
                        bl.setRotationFromEuler(block.rotation.x, block.rotation.y + 180, block.rotation.z);
                    } else {
                        // Fallback: rotate the root if child not found
                        legoClone.setRotationFromEuler(block.rotation.x, block.rotation.y + 180, block.rotation.z);
                    }
                    this.node.addChild(legoClone);
                });

                map = jsonAsset.json.levelBlockadesData.blockades;
                map.forEach((blockades) => {
                    const pf = this.getBlockadesByIndex(blockades.blockType);
                    if (!pf) return;
                    console.log(blockades.blockType);

                    if (blockades.rotation.x < 90) {
                        blockades.rotation.z += 180;
                        blockades.rotation.x += 180;
                    }

                    this.instantiateAndSetup(pf, blockades.position, blockades.rotation, blockades.scale);
                });

                map = jsonAsset.json.levelDoorsData.doors;
                map.forEach((door) => {
                    const pf = this.getDoorByIndex(door.doorPartCount);
                    if (!pf) return;

                    if (Math.round(door.rotation.z) === 90 || Math.round(door.rotation.z) === 270) {
                        door.rotation.z += 180;
                    }

                    this.instantiateAndSetup(pf, door.position, door.rotation);
                });

                this.createMapFromGrid(jsonAsset.json.gridSize.x, jsonAsset.json.gridSize.y);
            }
        });
    }

    createMapFromGrid(x: number, y: number) {
        const cols = (x - 1) / 2;
        const rows = (y - 1) / 2;
        const size = 2;
        for (let i = 0; i < x; i++) 
        {
            for (let j = 0; j < y; j++)
            {
                const node = instantiate(this.Grid);
                node.setPosition((i-cols) * size, (j-rows) * size, 0);
                this.node.addChild(node);
            }
        }

    }

    update(deltaTime: number) {}
}
