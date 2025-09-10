import { _decorator, Component, Node, MeshRenderer, Mesh } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('BlockPrefab')
export class BlockPrefab extends Component {
    start() {

    }

    @property(MeshRenderer)
    meshRenderer: MeshRenderer = null;

    setMesh(mesh : Mesh) {
        this.meshRenderer.mesh = mesh;
    }

    update(deltaTime: number) {
        
    }
}


