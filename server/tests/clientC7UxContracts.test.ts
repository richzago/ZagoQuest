/** C7 — contrato estático client ↔ Node (CI Node NÃO compila Unity C#). */
import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const unity = (p:string) => readFileSync(join(process.cwd(),"..",
  "Client","Assets","Resources","Scripts",p),"utf8");
const server = (p:string) => readFileSync(join(process.cwd(),"src",p),"utf8");

test("C7 câmera segue FPS independentemente, expõe zoom e usa limites Tiled",()=>{
 const cam=unity("Core/CameraFollow.cs"), game=unity("Core/GameManager.cs");
 const tiled=unity("World/TiledMapRenderer.cs");
 assert.match(cam,/Mathf\.Pow\(1f - rate, Time\.deltaTime \* 60f\)/);
 assert.match(cam,/public void SetZoom\(/);
 assert.match(cam,/PlayerPrefs\.GetFloat\(ZoomPreference/);
 assert.match(cam,/Mathf\.Clamp\(position\.x/);
 assert.match(cam,/GameManager\.Instance\.HasLoadedMap/);
 assert.match(cam,/delta >= teleportSnapDistance/);
 assert.match(cam,/Keyboard\.current\.equalsKey/);
 assert.match(game,/public int MapWidth => mapWidth/);
 assert.match(game,/public int MapHeight => mapHeight/);
 assert.match(tiled,/cam\.GetComponent<CameraFollow>\(\) == null/);
 assert.doesNotMatch(cam,/Vector3\.Lerp\(transform\.position, desiredPosition, smoothSpeed\)/);
});

test("C7 seleção não passa através de UI e procura perto do player, não da Hierarchy",()=>{
 const s=unity("Combat/TargetSelector.cs");
 assert.match(s,/IsPointerOverUi\(\)/);
 assert.match(s,/system\.RaycastAll\(pointer, uiHits\)/);
 assert.match(s,/GetComponentInParent<Canvas>\(\)/);
 assert.match(s,/Vector2 center = player\.transform\.position/);
 assert.match(s,/Physics2D\.OverlapCircleAll\(center, maxTargetDistance\)/);
 assert.match(s,/nearby\.Sort/);
 assert.match(s,/GetComponentInParent<TMP_InputField>\(\)/);
 assert.doesNotMatch(s,/OverlapCircleAll\(transform\.position, maxTargetDistance\)/);
});

test("C7 fishing: UI nasce pela NetworkManager, controle é do Node e duration visual",()=>{
 const net=unity("Networking/NetworkManager.cs");
 const ui=unity("UI/C7FishingUI.cs");
 const handler=unity("Networking/Handlers/FishingStatusHandler.cs");
 const sender=unity("Networking/Senders/FishingSender.cs");
 const registry=unity("Networking/Handlers/PacketHandlerRegistry.cs");
 const outgoing=unity("Networking/Messages/Outgoing/OutgoingMessages.cs");
 assert.match(net,/AddComponent<C7FishingUI>\(\)/);
 assert.match(net,/Fishing = new FishingSender\(socket\)/);
 assert.match(sender,/type = "startFishing"/);
 assert.match(sender,/type = "cancelFishing"/);
 assert.match(outgoing,/class StartFishingMessage/);
 assert.match(registry,/Register\("fishingStatus", new FishingStatusHandler\(\)\)/);
 assert.match(handler,/C7FishingUI\.Instance\?\.HandleFishingStatus/);
 assert.match(ui,/state == "started"/);
 assert.match(ui,/Keyboard\.current\.rKey\.wasPressedThisFrame/);
 assert.match(ui,/new GameObject\("C7FishingCanvas"/);
 assert.match(ui,/net\.Fishing\.StartFishing\(\)/);
 assert.match(ui,/net\.Fishing\.CancelFishing\(\)/);
 assert.match(ui,/Mathf\.Clamp01\(\(Time\.unscaledTime - startedAt\) \/ duration\)/);
 assert.doesNotMatch(ui,/player\.addItem|player\.mana|player\.hp/);
});

test("C7 tipos do servidor, guarda de sessão e dados de pesca sem confiança no cliente",()=>{
 const fishing=server("network/handlers/fishing.handler.ts");
 const fs=server("game/systems/fishingSystem.ts");
 const validation=server("network/validation/messageValidation.ts");
 assert.match(fishing,/FishingSystem\.startFishing\(player, ctx\.world/);
 assert.match(fishing,/FishingSystem\.cancelFishing\(player\)/);
 assert.match(fishing,/ws\.readyState !== WebSocket\.OPEN/);
 assert.match(fishing,/ctx\.packetSender\.inventory\.sendInventory\(player\)/);
 assert.match(fishing,/durationMs/);
 assert.match(fs,/activeFishingHooks\.delete\(player\)/);
 assert.match(validation,/z\.literal\("startFishing"\)/);
 assert.match(validation,/z\.literal\("cancelFishing"\)/);
 assert.match(fs,/world\.getTile\(px \+ dx, py \+ dy\)\?\.isWater/);
});

test("C7 acessibilidade: escala de UI local sem alterar gameplay ou senhas",()=>{
 const access=unity("UI/C7UiAccessibility.cs");
 const net=unity("Networking/NetworkManager.cs");
 assert.match(access,/Keyboard\.current\.f10Key/);
 assert.match(access,/Scales = \{ 1f, 1\.15f, 1\.30f \}/);
 assert.match(access,/CanvasScaler\.ScaleMode\.ScaleWithScreenSize/);
 assert.match(access,/PlayerPrefs\.SetInt\(PrefKey, current\)/);
 assert.match(access,/GetComponentInParent<TMP_InputField>/);
 assert.match(net,/AddComponent<C7UiAccessibility>\(\)/);
 assert.doesNotMatch(access,/JWT|password|_sessionToken/);
});
