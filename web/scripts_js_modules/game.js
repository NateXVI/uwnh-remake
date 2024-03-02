import { wasm } from './injector_wasm.js';
import { Entity } from './entity.js';
import { CollisionEntity } from './collision-entity.js';
import { ViewportEntity } from './viewport-entity.js';
import { Draggable } from './draggable.js';

var _GAME = wasm.instance.exports;
// TODO: THIS IS ALL FOR TESTING, REMOVE THIS SOON
window._GAME = _GAME;
window.extractMemory = function (memory_start, memory_length) {
    let data_view = new DataView(_GAME.memory.buffer, 0, _GAME.memory.byteLength);
    let data = [];
    for (let i = 0; i < memory_length; ++i) {
        let current_position = memory_start + (i * 2);
        data.push(data_view.getUint16(current_position, true));
    }
    return data;

    /**
     *  var world_id = _GAME.editor_createWorld(10, 10);
        var start = _GAME.editor_getWorldMemoryLocation(world_id);
        var length = _GAME.editor_getWorldMemoryLength(world_id);
        var world_data = extractMemory(start, length);
        world_data[0] = 0; // ID
        world_data[3] = 4; // Total Layers
        world_data[4] = 3; // Entity Layer
        world_data[5] = 4; // Collision Layer
        var world_data_as_blob = generateBlob(world_data);
        editorDownload(world_data_as_blob, 'world_0_data.bin');
        for (var i = 0; i < 4; ++i) {
            var layer_id = _GAME.editor_createLayer(10, 10);
            var start = _GAME.editor_getLayerMemoryLocation(world_id, layer_id);
            var length = _GAME.editor_getLayerMemoryLength(world_id, layer_id);
            var layer_data = extractMemory(start, length);
            var layer_data_as_blob = generateBlob(layer_data);
            editorDownload(layer_data_as_blob, 'layer_' + i + '.bin');
        }
        var entity_id = _GAME.editor_createEntity(99); // 99, 98, 1, 3(x4)
        var start = _GAME.editor_getEntityMemoryLocation(entity_id);
        var length = _GAME.editor_getEntityMemoryLength(entity_id);
        var entity_data = extractMemory(start, length);
        var entity_data_as_blob = generateBlob(entity_data);
        editorDownload(entity_data_as_blob, 'entity_0.bin');
     */
}
window.memoryToBin = function (memory_start, memory_length, file_name) {
    let blob = generateBlob(extractMemory(memory_start, memory_length));
    editorDownload(blob, file_name);
};
window.generateBlob = function (data) {
    return new Blob([new Uint16Array(data)], {type: 'application/octet-stream'});
};
window.editorDownload = function (data, file_name) {
    const link = document.createElement('a');
    const url = URL.createObjectURL(data);

    link.href = url;
    link.download = file_name;
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};
customElements.define('entity-component', Entity);
customElements.define('collision-entity-component', CollisionEntity);
customElements.define('viewport-entity-component', ViewportEntity);

// TODO
// Multi step
// *. kick-off the loop that runs the animation frames for anything with animations in it in the DOM
// *. run the requestAnimationFrame loop with a tick function
// *. pretty much the tick function iterates over frames and executes rendering of any appropriate entities and whatnot
// TODO: Put stats in editor mode only (use the menu)
// TODO: At some point after all elements are injected (editor and all that) we should run the draggable.js script
// *. Load twitch functionality
// *. Load multiplayer functionality

export class Game extends HTMLElement {
    constructor() {
        super();
        this.width = 0;
        this.height = 0;
        this.x_padding = 0;
        this.y_padding = 0;
        this.atlas = null;
        
        // TODO: Put this in a loader sub object
        this.atlas_loaded = false;
        this.layer_id_to_image_loaded = false;

        this.attachShadow({mode: 'open'});
    }

    connectedCallback() {
        this.render();
        
        Draggable(this.shadowRoot.querySelector('#main_menu'));
        var atlas = new Image();
        atlas.onload = () => {
            this.atlas_loaded = true;
            this.atlas = atlas;
            this.loaded();
        }
        atlas.src = GLOBALS.ATLAS_PNG_FILENAME;
        this.loadJsonFile(GLOBALS.LAYER_ID_TO_IMAGE_JSON_FILENAME, (data) => {
            if (data) {
                GLOBALS.LAYER_ID_TO_IMAGE = data;
                this.layer_id_to_image_loaded = true;
                this.loaded();
            }
        });
    }

    loadJsonFile(file_path, callback) {
        var xhr = new XMLHttpRequest();
        xhr.overrideMimeType('application/json');
        xhr.open('GET', file_path, true);

        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    var json_data;
                try {
                    json_data = JSON.parse(xhr.responseText);
                } catch (error) {
                    console.error('Error parsing JSON:', error.message);
                }
                callback(json_data);
            } else {
                console.error('Failed to fetch JSON file (' + xhr.status + ' ' + xhr.statusText + ')');
                callback(null);
            }
        }
        };

        xhr.send();
    }

    renderGame() {
        // TODO: Be smart. Only remove components you need and update existing ones
        var entity_components = this.shadowRoot.getElementById('view').querySelectorAll('entity-component');
        for (var i = 0; i < entity_components.length; ++i) {
            entity_components[i].remove();
        }
        var y = 0;
        var x = 0;
        // var cwi = _GAME.game_getCurrentWorldIndex();
        // if (DOM.width * DOM.height) !== _GAME.viewport_getLength() // panic
        for (var i = 0; i < (this.width * this.height); ++i) {
            var viewport_y = Math.floor(i / this.width);
            var viewport_x = i % this.width;
            if (_GAME.viewport_getData(viewport_x, viewport_y)) {
                // console.log({viewport_x, viewport_y});
                // Note: We do this so that, down the road, we can offset the layer in case we need that
                var layer = 0;
                var bg_tile_id = _GAME.game_getWorldDataAtViewportCoordinate(layer, viewport_x, viewport_y);
                if (bg_tile_id >= 0) {
                    var new_entity = document.createElement('entity-component');
                    new_entity.updateSize();
                    new_entity.setViewportXY(viewport_x, viewport_y);
                    new_entity.setLayer(layer);
                    new_entity.setEntityId(bg_tile_id);
                    this.shadowRoot.getElementById('view').appendChild(new_entity);
                }
                // ++layer;
                // var bg_tile_id = _GAME.game_getWorldDataAtViewportCoordinate(layer, viewport_x, viewport_y);
                // if (bg_tile_id > 0) {
                //     var new_entity = document.createElement('entity-component');
                //     new_entity.updateSize();
                //     new_entity.setViewportXY(viewport_x, viewport_y);
                //     new_entity.setLayer(layer);
                //     new_entity.setEntityId(bg_tile_id);
                //     this.shadowRoot.getElementById('view').appendChild(new_entity);
                // }

                // ++layer;
                // // TODO: Should pull ENTITY_LAYER from the wasm file
                // var ENTITY_LAYER = 2;
                // var entity_id = _GAME.game_getWorldDataAtViewportCoordinate(ENTITY_LAYER, viewport_x, viewport_y);
                // if (entity_id > 0) {
                //     var entity_type = null;
                //     // TODO: THIS IS THE WAY TO CATCH ERRORS FROM OUTPUT IN WASM
                //     try {
                //         entity_type = _GAME.game_entityGetType((entity_id -1));
                //     } catch (error) {
                //         console.error({error, viewport_x, viewport_y, entity_id});
                //     }
                //     if (entity_type === 99) {
                //         console.log('health restore');
                //         var div = document.createElement('div');
                //         div.style.width = (GLOBALS.SIZE * GLOBALS.SCALE) + 'px';
                //         div.style.height = (GLOBALS.SIZE * GLOBALS.SCALE) + 'px';
                //         div.style.position = 'absolute';
                //         div.style.left = (viewport_x * (GLOBALS.SIZE * GLOBALS.SCALE)) + 'px';
                //         div.style.top = (viewport_y * (GLOBALS.SIZE * GLOBALS.SCALE)) + 'px';
                //         div.style.backgroundColor = 'rgba(255, 0, 0, .7)';
                //         div.style.zIndex = layer;
                //         this.shadowRoot.getElementById('view').appendChild(div);
                //     } else if (entity_type === 98) {
                //         console.log('octopus');
                //         var div = document.createElement('div');
                //         div.style.width = (GLOBALS.SIZE * GLOBALS.SCALE) + 'px';
                //         div.style.height = (GLOBALS.SIZE * GLOBALS.SCALE) + 'px';
                //         div.style.position = 'absolute';
                //         div.style.left = (viewport_x * (GLOBALS.SIZE * GLOBALS.SCALE)) + 'px';
                //         div.style.top = (viewport_y * (GLOBALS.SIZE * GLOBALS.SCALE)) + 'px';
                //         div.style.backgroundColor = 'rgba(0, 0, 255, .7)';
                //         div.style.zIndex = layer;
                //         this.shadowRoot.getElementById('view').appendChild(div);
                //     } else if (entity_id > 0) {
                //         var new_entity = document.createElement('entity-component');
                //         new_entity.updateSize();
                //         new_entity.setViewportXY(viewport_x, viewport_y);
                //         new_entity.setLayer(layer);
                //         new_entity.setEntityId(entity_id);
                //         this.shadowRoot.getElementById('view').appendChild(new_entity);
                //     }
                //     // TODO: ENTITY_TYPE_OR_ID_TO_IMAGE where type is first and then ID
                // }
            }
        }
    }

    watchResize() {
        console.log('watching resize');
        const resizeObserver = new ResizeObserver((entries) => {
            // console.log('resize observed');
            const entry = entries[0];
            // entry.contentRect
            this.sizeView();
            _GAME.viewport_setSize(this.width, this.height);
            _GAME.game_loadWorld(_GAME.game_getCurrentWorldIndex());
            // Dispatch an event to let the editor know the
            // size of the viewport
            // NOTE: If you move this into "sizeView" function,
            // it borks the rendering order and causes a panic/out
            // of bounds error in WASM/ZIG
            GLOBALS.EVENTBUS.triggerEvent('viewport-size', [
                {
                    width: this.width,
                    height: this.height,
                    x_padding: this.x_padding,
                    y_padding: this.y_padding
                }
            ]);
            this.renderGame();
        });
        resizeObserver.observe(document.body);
    }

    loaded(e) {
        // TODO: Maybe put a loader component here and let that load first so you can separate out the logic, then the component can dispatch an event when it's done
        // console.log('test', [e, this]);
        if (this.atlas_loaded && this.layer_id_to_image_loaded) {
            console.log('Loaded');
            // this.sizeView();
            _GAME.game_initializeGame();
            this.watchResize();
        }
    }

    disconnectedCallback() {}
    adoptedCallback() {}
    attributeChangedCallback() {}

    sizeView () {
        // Full height, including the scroll part
        const full_height = Math.max(
            // document.body.scrollHeight,
            // document.documentElement.scrollHeight,
            // document.body.offsetHeight,
            // document.documentElement.offsetHeight,
            document.body.clientHeight,
            // document.documentElement.clientHeight
        );
        // Full width, including the scroll part
        const full_width = Math.max(
            // document.body.scrollWidth,
            // document.documentElement.scrollWidth,
            // document.body.offsetWidth,
            // document.documentElement.offsetWidth,
            document.body.clientWidth,
            // document.documentElement.clientWidth
        );

        const root = document.documentElement;
        root.style.setProperty('--scale', GLOBALS.SCALE);

        // console.trace({full_width, full_height});

        let x = Math.floor(full_width / (GLOBALS.SIZE * GLOBALS.SCALE));
        let y = Math.floor(full_height / (GLOBALS.SIZE * GLOBALS.SCALE));
        // TODO: What is this magic number 6?
        if (x > 6)
        {
            --x;
        }
        if (y > 6)
        {
            --y;
        }
        let x_padding = (full_width - (x * (GLOBALS.SIZE * GLOBALS.SCALE))) / 2;
        let y_padding = (full_height - (y * (GLOBALS.SIZE * GLOBALS.SCALE))) / 2;
        this.shadowRoot.getElementById('view').style.margin = y_padding + 'px ' + x_padding + 'px';
        this.shadowRoot.getElementById('view').style.width = (x * (GLOBALS.SIZE * GLOBALS.SCALE)) + 'px';
        this.shadowRoot.getElementById('view').style.height = (y * (GLOBALS.SIZE * GLOBALS.SCALE)) + 'px';
        this.shadowRoot.getElementById('clickable_view').style.width = (x * (GLOBALS.SIZE * GLOBALS.SCALE)) + 'px';
        this.shadowRoot.getElementById('clickable_view').style.height = (y * (GLOBALS.SIZE * GLOBALS.SCALE)) + 'px';
        this.width = x;
        this.height = y;
        this.x_padding = x_padding;
        this.y_padding = y_padding;
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
            .two-column-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                grid-gap: 1em 0em;
                align-items: center;
            }
            .title {
                text-align: center;
                font-size: 1.5em;
            }
            .hidden {
                display: none !important;
            }
            #clickable_view {
                width: 100%;
                height: 100vh;
                position: absolute;
                z-index: 1000;
            }
            #view {
                width: 100%;
                height: 100vh;
                /*display: flex;
                align-items: center;
                justify-content: center;*/
                background-image: 
                    linear-gradient(rgba(0, 255, 0, .7) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0, 255, 0, .7) 1px, transparent 1px);
                background-size: var(--scaled-size-px) var(--scaled-size-px);
                background-position: -1px -1px;
                position: relative;
            }
            #main_menu {
                position: absolute;
                top: 0px;
                left: 0px;
                width: 400px;
                height: 400px;
                z-index: 1000001;
                background-color: rgba(0, 0, 0, 0.96);
                color: white;
                border: 2px solid orange;
                border-radius: 8px;

                padding: 0.6em;
                display: grid;
                grid-auto-flow: row;
                overflow-y: auto;
            }
            .draggable-header {
                width: 100%;
                height: 2em;
                background-color: orange;
            }
            </style>
            <div id="main_menu">
                <div class="draggable-header"></div>
                <div class="title">Main Menu</div>
                <div class="two-column-grid">
                    <div>FPS</div><div>XXX</div>
                </div>
                <div class="two-column-grid">
                    <div>Els</div><div>XXX</div>
                </div>
                <div class="two-column-grid">
                    <div>Mode</div><div>XXX</div>
                </div>
                <div>
                    Press 'H' for help
                </div>
                <div>
                    Press 'X' to hide/show this
                </div>
            </div>
            <div id="clickable_view"></div>
            <div id="view"></div>
        `;
    }
}
