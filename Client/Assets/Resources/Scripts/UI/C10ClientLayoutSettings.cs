using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// C10: configurações locais do cliente, nunca enviadas ao Node.
/// Barra central de equipamentos usa C8SidebarShell; colunas extras reais
/// recebem os MESMOS painéis de Backpack/Loot (sem clonar inventários).
/// Habilidades ainda não implementadas: action bars são apenas estruturas
/// visuais sem botões de magia falsos.
/// </summary>
[DisallowMultipleComponent]
public sealed class C10ClientLayoutSettings : MonoBehaviour
{
    public static C10ClientLayoutSettings Instance { get; private set; }
    private const string Prefix = "ZagoQuest.C10.";
    public const float ExtraBarWidth = 172f;
    public const float MainCompactWidth = 228f;
    public const float MainComfortWidth = 276f;
    private static readonly Color32 Surface = C11VisualTheme.Surface;
    private static readonly Color32 Cell = C11VisualTheme.Row;
    private static readonly Color32 Gold = C11VisualTheme.Bronze;
    private static readonly Color32 White = C11VisualTheme.Text;

    public int LeftColumns => Mathf.Clamp(PlayerPrefs.GetInt(Prefix + "Left",0),0,3);
    public int RightColumns => Mathf.Clamp(PlayerPrefs.GetInt(Prefix + "Right",1),1,3);
    public bool Compact => PlayerPrefs.GetInt(Prefix + "Compact",1) == 1;
    public int BagSide => Mathf.Clamp(PlayerPrefs.GetInt(Prefix + "BagSide",1),0,2);
    public int LootSide => Mathf.Clamp(PlayerPrefs.GetInt(Prefix + "LootSide",0),0,2);
    public bool TopSpells => PlayerPrefs.GetInt(Prefix + "TopSpells",0) == 1;
    public bool MiddleSpells => PlayerPrefs.GetInt(Prefix + "MiddleSpells",0) == 1;
    public bool BottomSpells => PlayerPrefs.GetInt(Prefix + "BottomSpells",0) == 1;

    private C8SidebarShell shell;
    private Button gear;
    private GameObject canvasRoot, settingsPanel;
    private readonly List<GameObject> rails = new List<GameObject>();
    private readonly List<GameObject> spellBars = new List<GameObject>();
    private readonly List<RectTransform> leftHosts = new List<RectTransform>();
    private readonly List<RectTransform> rightHosts = new List<RectTransform>();
    private float lastScreenWidth = -1f;
    private float lastScreenHeight = -1f;
    private bool rebuildRequested = true;

    private void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(this); return; }
        Instance = this;
        shell = GetComponent<C8SidebarShell>();
    }

    private void LateUpdate()
    {
        if (shell == null) shell = GetComponent<C8SidebarShell>();
        if (shell == null || shell.SidebarSurface == null) return;
        if (gear == null) WireGear();
        if (canvasRoot == null) BuildOverlay();
        if (!rebuildRequested && Mathf.Abs(Screen.width-lastScreenWidth)<1f &&
            Mathf.Abs(Screen.height-lastScreenHeight)<1f) return;
        lastScreenWidth = Screen.width;
        lastScreenHeight = Screen.height;
        rebuildRequested = false;
        RebuildRails();
        shell.ApplyClientDensity();
        RefreshRows();
    }

    private void WireGear()
    {
        var host = shell.QuickAccessHost;
        var transform = host != null ? host.Find("SettingsIcon") : null;
        if (transform == null) return;
        var image = transform.GetComponent<Image>();
        if (image != null) image.raycastTarget = true;
        gear = transform.GetComponent<Button>();
        if (gear == null) gear = transform.gameObject.AddComponent<Button>();
        gear.onClick.AddListener(Toggle);
        gear.transition = Selectable.Transition.ColorTint;
    }

    private static TextMeshProUGUI Label(Transform parent, string name, string value,
        float size, TextAlignmentOptions align)
    {
        var obj = new GameObject(name, typeof(RectTransform), typeof(TextMeshProUGUI));
        obj.transform.SetParent(parent,false);
        var text = obj.GetComponent<TextMeshProUGUI>();
        text.text = value; text.fontSize = size; text.color = White;
        text.alignment = align; text.raycastTarget = false;
        var rect = text.rectTransform;
        rect.anchorMin=Vector2.zero; rect.anchorMax=Vector2.one;
        rect.offsetMin=rect.offsetMax=Vector2.zero;
        return text;
    }

    private static Button MakeButton(Transform parent,string name,string caption,
        Vector2 min, Vector2 max, Action onClick)
    {
        var obj = new GameObject(name,typeof(RectTransform),typeof(Image),typeof(Button));
        obj.transform.SetParent(parent,false);
        var rect = (RectTransform)obj.transform;
        rect.anchorMin=min;rect.anchorMax=max;
        rect.offsetMin=new Vector2(2f,2f);
        rect.offsetMax=new Vector2(-2f,-2f);
        obj.GetComponent<Image>().color=Cell;
        C11VisualTheme.Frame(obj);
        var button=obj.GetComponent<Button>();
        C11VisualTheme.StyleButton(button);
        button.onClick.AddListener(()=>onClick());
        Label(rect,"Text",caption,13f,TextAlignmentOptions.Center);
        return button;
    }

    private void BuildOverlay()
    {
        canvasRoot = new GameObject("C10SettingsCanvas",
            typeof(RectTransform),typeof(Canvas),
            typeof(CanvasScaler),typeof(GraphicRaycaster));
        var canvas=canvasRoot.GetComponent<Canvas>();
        canvas.renderMode=RenderMode.ScreenSpaceOverlay;
        canvas.overrideSorting=true;canvas.sortingOrder=440;
        var scaler=canvasRoot.GetComponent<CanvasScaler>();
        scaler.uiScaleMode=CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution=new Vector2(1920,1080);
        scaler.matchWidthOrHeight=0.5f;

        settingsPanel=new GameObject("ClientSettingsPanel",typeof(RectTransform),typeof(Image));
        settingsPanel.transform.SetParent(canvasRoot.transform,false);
        var rect=(RectTransform)settingsPanel.transform;
        rect.anchorMin=rect.anchorMax=rect.pivot=new Vector2(0.5f,0.5f);
        rect.sizeDelta=new Vector2(438f,468f);
        rect.anchoredPosition=Vector2.zero;
        settingsPanel.GetComponent<Image>().color=Surface;
        C11VisualTheme.Frame(settingsPanel);
        var title=Label(rect,"Title","CONFIGURAÇÕES  /  CLIENTE",17f,TextAlignmentOptions.Center);
        var titleRect=title.rectTransform;
        titleRect.anchorMin=new Vector2(0f,1f);titleRect.anchorMax=Vector2.one;
        titleRect.offsetMin=new Vector2(12f,-44f);titleRect.offsetMax=new Vector2(-12f,-8f);
        MakeButton(rect,"Close","×",new Vector2(0.91f,0.925f),
            new Vector2(1f,1f),Toggle);
        settingsPanel.SetActive(false);
    }

    private void Toggle()
    {
        if (settingsPanel == null) return;
        settingsPanel.SetActive(!settingsPanel.activeSelf);
        if (settingsPanel.activeSelf) RefreshRows();
    }

    private void Set(string key,int value)
    {
        PlayerPrefs.SetInt(Prefix+key,value);
        PlayerPrefs.Save();
        rebuildRequested=true;
        RefreshRows();
    }

    private void RefreshRows()
    {
        if (settingsPanel == null || !settingsPanel.activeSelf) return;
        var panel=settingsPanel.transform;
        for(int i=panel.childCount-1;i>=0;i--)
        {
            var child=panel.GetChild(i);
            if (child.name.StartsWith("C10Row",StringComparison.Ordinal))
            { child.gameObject.SetActive(false);Destroy(child.gameObject); }
        }

        Row(panel,0,"Colunas à esquerda",LeftColumns.ToString(),
            ()=>Set("Left",Mathf.Max(0,LeftColumns-1)),
            ()=>Set("Left",Mathf.Min(3,LeftColumns+1)));
        Row(panel,1,"Colunas à direita",RightColumns.ToString(),
            ()=>Set("Right",Mathf.Max(1,RightColumns-1)),
            ()=>Set("Right",Mathf.Min(3,RightColumns+1)));
        Row(panel,2,"Largura dos painéis",Compact?"COMPACTA":"CONFORTO",
            ()=>Set("Compact",Compact?0:1),()=>Set("Compact",Compact?0:1));
        Row(panel,3,"Backpack / Bag",SideLabel(BagSide),
            ()=>Set("BagSide",(BagSide+2)%3),()=>Set("BagSide",(BagSide+1)%3));
        Row(panel,4,"Loot",SideLabel(LootSide),
            ()=>Set("LootSide",(LootSide+2)%3),()=>Set("LootSide",(LootSide+1)%3));
        Row(panel,5,"Magias no topo",TopSpells?"VISÍVEL":"OCULTA",
            ()=>Set("TopSpells",TopSpells?0:1),()=>Set("TopSpells",TopSpells?0:1));
        Row(panel,6,"Magias no centro",MiddleSpells?"VISÍVEL":"OCULTA",
            ()=>Set("MiddleSpells",MiddleSpells?0:1),()=>Set("MiddleSpells",MiddleSpells?0:1));
        Row(panel,7,"Magias embaixo",BottomSpells?"VISÍVEL":"OCULTA",
            ()=>Set("BottomSpells",BottomSpells?0:1),()=>Set("BottomSpells",BottomSpells?0:1));

        var note=Label(panel,"C10RowNote",
            "Colunas extras recebem Bag/Loot. Faixas de magia são reserva visual, sem feitiços ainda. Layout salvo neste computador.",
            11f,TextAlignmentOptions.Center);
        note.rectTransform.anchorMin=new Vector2(0.06f,0.06f);
        note.rectTransform.anchorMax=new Vector2(0.94f,0.13f);
        note.rectTransform.offsetMin=note.rectTransform.offsetMax=Vector2.zero;
    }

    private static string SideLabel(int v) => v==0?"ESQUERDA":v==1?"PRINCIPAL":"EXTRA DIR.";

    private static void Row(Transform panel,int index,string title,string value,
        Action previous,Action next)
    {
        var row=new GameObject("C10Row"+index,typeof(RectTransform));
        row.transform.SetParent(panel,false);
        var r=(RectTransform)row.transform;
        r.anchorMin=new Vector2(0.04f,1f);r.anchorMax=new Vector2(0.96f,1f);
        r.pivot=new Vector2(0.5f,1f);
        float top=53f+index*43f;
        r.offsetMin=new Vector2(0f,-top-40f);
        r.offsetMax=new Vector2(0f,-top);
        var titleObj=new GameObject("Label",typeof(RectTransform),typeof(TextMeshProUGUI));
        titleObj.transform.SetParent(r,false);
        var l=titleObj.GetComponent<TextMeshProUGUI>();
        l.text=title;l.fontSize=13;l.color=White;
        l.alignment=TextAlignmentOptions.MidlineLeft;l.raycastTarget=false;
        var lr=l.rectTransform;
        lr.anchorMin=new Vector2(0,0);lr.anchorMax=new Vector2(0.51f,1);
        lr.offsetMin=lr.offsetMax=Vector2.zero;
        MakeButton(r,"Previous","‹",new Vector2(.52f,0),new Vector2(.62f,1),previous);
        var current=Label(r,"Current",value,12f,TextAlignmentOptions.Center);
        current.rectTransform.anchorMin=new Vector2(.63f,0);
        current.rectTransform.anchorMax=new Vector2(.89f,1);
        current.rectTransform.offsetMin=current.rectTransform.offsetMax=Vector2.zero;
        MakeButton(r,"Next","›",new Vector2(.90f,0),Vector2.one,next);
    }

    private void RebuildRails()
    {
        GetComponent<C8SidebarDynamicDock>()?.ReturnToPrimaryHost();
        foreach(var old in rails) if(old!=null) Destroy(old);
        foreach(var old in spellBars) if(old!=null) Destroy(old);
        rails.Clear();spellBars.Clear();leftHosts.Clear();rightHosts.Clear();
        var parent=shell.SidebarSurface.parent;
        if(parent==null) return;
        // A Game View pequena jamais será coberta por seis barras.
        int maxExtras=Mathf.Max(0,Mathf.FloorToInt(
            (Screen.width*0.56f-(Compact?MainCompactWidth:MainComfortWidth))/ExtraBarWidth));
        int rightExtra=Mathf.Min(RightColumns-1,maxExtras);
        int leftActual=Mathf.Min(LeftColumns,Mathf.Max(0,maxExtras-rightExtra));
        for(int i=0;i<leftActual;i++)
            leftHosts.Add(CreateRail(parent,"Left"+i,true,i,
                ExtraBarWidth));
        for(int i=0;i<rightExtra;i++)
            rightHosts.Add(CreateRail(parent,"RightExtra"+i,false,i,
                ExtraBarWidth));
        if(TopSpells) AddSpells(parent,"Top",new Vector2(0.5f,1f),-21f);
        if(MiddleSpells) AddSpells(parent,"Center",new Vector2(0.5f,0.5f),0f);
        if(BottomSpells) AddSpells(parent,"Bottom",new Vector2(0.5f,0f),22f);
    }

    private RectTransform CreateRail(Transform canvas,string name,bool left,
        int index,float width)
    {
        var go=new GameObject("C10"+name,typeof(RectTransform),typeof(Image));
        go.transform.SetParent(canvas,false);
        var r=(RectTransform)go.transform;
        r.anchorMin=left?new Vector2(0,0):new Vector2(1,0);
        r.anchorMax=left?new Vector2(0,1):new Vector2(1,1);
        r.pivot=new Vector2(left?0f:1f,.5f);
        r.anchoredPosition=new Vector2(left?index*width:
            -(Compact?MainCompactWidth:MainComfortWidth)-index*width,0f);
        r.sizeDelta=new Vector2(width,0);
        go.GetComponent<Image>().color=Surface;
        C11VisualTheme.Frame(go);
        var title=Label(go.transform,"LaneTitle",left?"BARRA ESQ.":"BARRA DIR.",
            11f,TextAlignmentOptions.Center);
        title.rectTransform.anchorMin=new Vector2(0,1);
        title.rectTransform.anchorMax=Vector2.one;
        title.rectTransform.offsetMin=new Vector2(2,-31);
        title.rectTransform.offsetMax=new Vector2(-2,-5);
        var hostGo=new GameObject("ContentHost",typeof(RectTransform),typeof(RectMask2D));
        hostGo.transform.SetParent(go.transform,false);
        var host=(RectTransform)hostGo.transform;
        host.anchorMin=Vector2.zero;host.anchorMax=Vector2.one;
        host.offsetMin=new Vector2(4,4);host.offsetMax=new Vector2(-4,-36);
        rails.Add(go);
        return host;
    }

    private void AddSpells(Transform canvas,string name,Vector2 anchor,float offset)
    {
        var go=new GameObject("C10SpellBar"+name,typeof(RectTransform),typeof(Image));
        go.transform.SetParent(canvas,false);
        var r=(RectTransform)go.transform;
        r.anchorMin=r.anchorMax=r.pivot=anchor;
        r.sizeDelta=new Vector2(340f,30f);
        r.anchoredPosition=new Vector2(0,offset);
        var img=go.GetComponent<Image>();img.color=new Color32(23,37,50,192);
        img.raycastTarget=false;
        Label(go.transform,"Hint","MAGIAS • "+name.ToUpperInvariant()+"  |  slots reservados",
            11f,TextAlignmentOptions.Center);
        spellBars.Add(go);
    }

    public RectTransform BagHost
    {
        get {
            if(BagSide==0 && leftHosts.Count>0) return leftHosts[0];
            if(BagSide==2 && rightHosts.Count>0) return rightHosts[0];
            return null; // sidebar principal C8
        }
    }
    public RectTransform LootHost
    {
        get {
            if(LootSide==0 && leftHosts.Count>0) return leftHosts[leftHosts.Count-1];
            if(LootSide==2 && rightHosts.Count>0) return rightHosts[rightHosts.Count-1];
            return null;
        }
    }

    public void GetPixelMargins(out float left,out float right)
    {
        left=0f;right=0f;
        var corners=new Vector3[4];
        foreach(var host in leftHosts) {
            if(host==null)continue;
            ((RectTransform)host.parent).GetWorldCorners(corners);
            left=Mathf.Max(left,RectTransformUtility.WorldToScreenPoint(null,corners[2]).x);
        }
        foreach(var host in rightHosts) {
            if(host==null)continue;
            ((RectTransform)host.parent).GetWorldCorners(corners);
            right=Mathf.Max(right,Screen.width-
                RectTransformUtility.WorldToScreenPoint(null,corners[0]).x);
        }
    }

    private void OnDestroy()
    {
        if(Instance==this) Instance=null;
        if(gear!=null)gear.onClick.RemoveListener(Toggle);
        // C8 resgata os painéis ANTES que seus antigos hosts desapareçam.
        GetComponent<C8SidebarDynamicDock>()?.ReturnToPrimaryHost();
        foreach(var rail in rails)if(rail!=null)Destroy(rail);
        foreach(var bar in spellBars)if(bar!=null)Destroy(bar);
        if(canvasRoot!=null)Destroy(canvasRoot);
    }
}
