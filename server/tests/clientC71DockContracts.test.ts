/** C7.1: contratos estáticos dos componentes Unity, sem simular Editor/Hierarchy. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
const unity=(name:string)=>readFileSync(join(process.cwd(),"..","Client",
 "Assets","Resources","Scripts",name),"utf8");
test("C7.1: painel stack vertical sem overlap, largura fixa e scroll",()=>{
 const dock=unity("UI/C7DockLayout.cs");
 const resize=unity("UI/C7DockResizeGrip.cs");
 const drag=unity("UI/C6WindowDragHandle.cs");
 const network=unity("Networking/NetworkManager.cs");
 assert.match(network,/AddComponent<C7DockLayout>\(\)/);
 assert.match(dock,/new VerticalLayoutGroup|typeof\(VerticalLayoutGroup\)/);
 assert.match(dock,/group\.childControlHeight = true/);
 assert.match(dock,/scroll\.vertical = true/);
 assert.match(dock,/scroll\.horizontal = false/);
 assert.match(dock,/private const float SidebarWidth = 314f/);
 assert.match(dock,/typeof\(C7DockResizeGrip\)/);
 assert.match(dock,/registered\[panel\] = layout/);
 assert.match(dock,/layout\.preferredHeight = Mathf\.Clamp/);
 assert.match(dock,/PlayerPrefs\.SetFloat\(KeyPrefix/);
 assert.match(dock,/loot\.lootPanel\.GetComponent<RectTransform>\(\)/);
 assert.match(dock,/originalHeights\[panel\] = initialHeight/);
 assert.match(drag,/C7DockLayout\.IsDocked\(panel\)/);
 assert.match(drag,/C7DockLayout\.Reorder\(panel/);
 assert.match(drag,/C7DockLayout\.ResetHeight\(panel\)/);
 assert.match(resize,/C7DockLayout\.Resize\(panel/);
 assert.doesNotMatch(resize,/sizeDelta\.x|delta\.x|width\s*=/);
});
test("C7.2: viewport integral e insets físicos protegem câmera do dock",()=>{
 const dock=unity("UI/C7DockLayout.cs");
 const cam=unity("Core/CameraFollow.cs");
 assert.match(dock,/TryGetWorldInsets\(out float rightPixels, out float bottomPixels\)/);
 assert.match(dock,/worldCamera\.rect = new Rect\(0f, 0f, 1f, 1f\)/);
 assert.doesNotMatch(dock,/worldCamera\.rect = desired/);
 assert.match(dock,/rightPixels = Mathf\.Clamp\(SidebarWidth \* scale/);
 assert.match(dock,/bottomPixels = Mathf\.Clamp\(ChatHeight \* scale/);
 assert.match(dock,/chat\.anchoredPosition = new Vector2\(8f, 4f\)/);
 assert.match(cam,/desired\.x \+= rightPixels \* 0\.5f \* unitsPerPixel/);
 assert.match(cam,/desired\.y -= bottomPixels \* 0\.5f \* unitsPerPixel/);
 assert.match(cam,/target\.position\.x - maxTargetDx, target\.position\.x - minTargetDx/);
 assert.match(cam,/target\.position\.y - maxTargetDy, target\.position\.y - minTargetDy/);
 assert.match(dock,/layout\.minHeight = key\.Contains/);
 assert.match(dock,/layout\.minHeight, Mathf\.Max\(layout\.minHeight, maxHeight\)/);
});

test("C7.2: modelo de câmera mantém player na região segura em cantos/F10",()=>{
 // Teste matemático do contrato, NÃO substitui renderização Unity/URP.
 const clamp=(v:number,min:number,max:number)=>Math.min(Math.max(v,min),max);
 const map={width:30,height:20};
 for(const [width,height] of [[1280,720],[1920,1080],[1024,768]]){
  for(const uiScale of [1,1.15,1.30]){
   for(const zoom of [3.5,6.5,12]){
    const factor=width/1920*uiScale;
    const right=clamp(314*factor,0,width*.75);
    const bottom=clamp(222*factor,0,height*.60);
    const unitsPerPixel=2*zoom/height;
    const halfWidth=zoom*width/height;
    const border=Math.min(16,Math.min(width,height)*.018);
    for(const [x,y] of [[3,3],[26,3],[3,16],[26,16],[15,9]]){
     let cx=x+right*.5*unitsPerPixel;
     let cy=y-bottom*.5*unitsPerPixel;
     cx=map.width<=halfWidth*2?(map.width-1)*.5:
       clamp(cx,halfWidth-.5,map.width-.5-halfWidth);
     cy=map.height<=zoom*2?(map.height-1)*.5:
       clamp(cy,zoom-.5,map.height-.5-zoom);
     cx=clamp(cx,x-(width*.5-right-border)*unitsPerPixel,
                  x-(-width*.5+border)*unitsPerPixel);
     cy=clamp(cy,y-(height*.5-border)*unitsPerPixel,
                  y-(bottom+border-height*.5)*unitsPerPixel);
     const screenX=width*.5+(x-cx)/unitsPerPixel;
     const screenY=height*.5+(y-cy)/unitsPerPixel;
     assert.ok(screenX>=border-1e-6 && screenX<=width-right-border+1e-6,
       `X fora do mundo: ${width}x${height}, F10=${uiScale}, zoom=${zoom}, pos=${x},${y}`);
     assert.ok(screenY>=bottom+border-1e-6 && screenY<=height-border+1e-6,
       `Y encoberto: ${width}x${height}, F10=${uiScale}, zoom=${zoom}, pos=${x},${y}`);
    }
   }
  }
 }
});
test("C7.1: painéis menores, controles merchant em duas linhas, pesca entra no dock",()=>{
 const fish=unity("UI/C7FishingUI.cs");
 const shop=unity("NPC/ShopItemSlot.cs");
 const slots=unity("UI/C6InventoryEquipmentLayout.cs");
 const inv=unity("Player/InventorySlot.cs");
 assert.match(fish,/MakeDraggable\(panel, "PESCA", "fishing"\)/);
 assert.match(fish,/panelObject\.SetActive\(connected\)/);
 assert.match(shop,/0\.28f, 0\.06f, 0\.60f, 0\.35f/);
 assert.match(shop,/0\.64f, 0\.06f, 0\.96f, 0\.35f/);
 assert.match(slots,/grid\.cellSize = new Vector2\(82, 82\)/);
 assert.match(inv,/rect\.sizeDelta = new Vector2\(42, 42\)/);
});
