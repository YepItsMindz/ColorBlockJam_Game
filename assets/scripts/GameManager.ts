import { _decorator, Component, instantiate, JsonAsset, Mesh, Node, Prefab, resources } from 'cc';
const { ccclass, property } = _decorator;



@ccclass('GameManager')
export class GameManager extends Component {
    @property(Prefab) 
    legoFlatPrefab: Prefab = null;


	start() {
        this.loadLevel(6)
	}

    static blockType: Record<number, string> = {
        0: "1",
        1: "8",
        2: "7",
        3: "6",
        4: "6",
        5: "2",
        6: "3",
        7: "4",
        8: "5",
        9: "9",
        10: "9",
        11: "10"
    };

	loadLevel(index : number) {
        console.log(this.legoFlatPrefab);
		const name = `Level ${index}`;
		resources.load(`level/${name}`, (err: Error, jsonAsset : JsonAsset) => {
			if (!err) {
                const node = instantiate(this.legoFlatPrefab)
                const map = jsonAsset.json.levelBlockGroupsData.blockGroupDatas;
                map.forEach(block => {
                    const legoNode = node.getChildByName(`Lego_Flat_${GameManager.blockType[block.blockGroupType]}`)
                    if (legoNode) {
                        const legoClone = instantiate(legoNode);
                        legoClone.setPosition(block.position.x, block.position.y, block.position.z);
                        legoClone.setRotationFromEuler(block.rotation.x, 180, block.rotation.z);
                        this.node.addChild(legoClone);
                    }
                })
                
			}
		});
	}

	update(deltaTime: number) {
		
	}
}


