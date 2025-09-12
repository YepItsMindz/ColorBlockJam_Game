import { _decorator, Component, instantiate, JsonAsset, Mesh, Node, Prefab, resources, Vec3 } from 'cc';
const { ccclass, property } = _decorator;



@ccclass('GameManager')
export class GameManager extends Component {
    @property([Prefab]) 
    BlockGroup: Prefab[] = [];

    @property([Prefab])
    Blockades: Prefab[] = [];



	start() {
        this.loadLevel(1)
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

	loadLevel(index : number) {
		const name = `Level ${index}`;
		resources.load(`level/${name}`, (err: Error, jsonAsset : JsonAsset) => {
			if (!err) {
                let map = jsonAsset.json.levelBlockGroupsData.blockGroupDatas;
                map.forEach(block => {
                    const pf = this.getBlockGroupByIndex(block.blockGroupType);
                    const legoClone = instantiate(pf);
                    legoClone.setPosition(block.position.x, block.position.y, block.position.z);
                    const bl = legoClone.getChildByName("Block");
                    if (block.blockGroupType == 5 || block.blockGroupType == 11){
                        block.rotation.y += 180
                    } 
                    bl.setRotationFromEuler(block.rotation.x, block.rotation.y + 180, block.rotation.z);
                    this.node.addChild(legoClone);
                })  

                map = jsonAsset.json.levelBlockadesData.blockades;
                map.forEach(blockades => {
                    const pf = this.getBlockadesByIndex(blockades.blockType);
                    const blockadesClone = instantiate(pf);
                    blockadesClone.setPosition(blockades.position.x, blockades.position.y, blockades.position.z);
                    blockadesClone.setRotationFromEuler(blockades.rotation.x, blockades.rotation.y + 180, blockades.rotation.z);
                    this.node.addChild(blockadesClone);
                })  
            }
		});
	}

	update(deltaTime: number) {
		
	}
}


