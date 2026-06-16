using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using System.Collections.Generic;

public class TargetSelector : MonoBehaviour
{
    public static TargetSelector Instance { get; private set; }

    [Header("Configurações")]
    public float maxTargetDistance = 5f;

    private string currentTargetId = null;
    private GameObject currentTarget = null; // ← adicionado
    private List<string> monstersInRangeIds = new List<string>();

    private InputAction mouseClickAction;
    private InputAction attackAction;

    void Awake()
    {
        if (Instance == null) Instance = this;
        else Destroy(gameObject);

        mouseClickAction = new InputAction("MouseClick", binding: "<Mouse>/leftButton");
        attackAction = new InputAction("Attack", binding: "<Keyboard>/space");

        mouseClickAction.performed += ctx => OnMouseClick();
        attackAction.performed += ctx => OnAttackKey();
    }

    void OnEnable()
    {
        mouseClickAction.Enable();
        attackAction.Enable();
    }

    void OnDisable()
    {
        mouseClickAction.Disable();
        attackAction.Disable();
    }

    private void OnMouseClick()
    {
        if (ChatUI.IsChatActive) return;

        Ray ray = Camera.main.ScreenPointToRay(Mouse.current.position.ReadValue());
        RaycastHit2D hit = Physics2D.GetRayIntersection(ray);
        if (hit.collider != null)
        {
            if (hit.collider.CompareTag("Monster"))
            {
                string clickedId = GetEntityIdFromGameObject(hit.collider.gameObject);
                if (!string.IsNullOrEmpty(clickedId))
                {
                    if (currentTargetId == clickedId)
                        AttackCurrentTarget();
                    else
                        SelectTarget(clickedId);
                }
            }
            else if (hit.collider.CompareTag("Corpse"))
            {
                CorpseIdentity corpse = hit.collider.GetComponent<CorpseIdentity>();
                if (corpse != null && !string.IsNullOrEmpty(corpse.corpseId))
                    NetworkManager.Instance.SendLoot(corpse.corpseId);
            }
            else
            {
                ClearTarget();
            }
        }
        else
        {
            ClearTarget();
        }
    }

    private void OnAttackKey()
    {
        if (ChatUI.IsChatActive) return;
        if (!string.IsNullOrEmpty(currentTargetId) && IsTargetInRange(currentTargetId))
            AttackCurrentTarget();
        else
        {
            CycleToNextMonster();
            if (!string.IsNullOrEmpty(currentTargetId)) AttackCurrentTarget();
        }
    }

    public void SelectTarget(string targetId)
    {
        if (currentTarget != null && currentTarget.CompareTag("Monster"))
            NetworkManager.Instance.SendStopAutoAttack();

        currentTargetId = targetId;
        currentTarget = EntityManager.Instance.GetGameObject(targetId);
        NetworkManager.Instance.SendStartAutoAttack(targetId);
    }

    public void ClearTarget()
    {
        if (!string.IsNullOrEmpty(currentTargetId))
        {
            GameObject go = EntityManager.Instance.GetGameObject(currentTargetId);
            if (go != null) RemoveSelectionOutline(go);
            currentTargetId = null;
            currentTarget = null;
        }
    }

    public void ClearTargetIfMatches(GameObject go)
    {
        MonsterIdentity idComp = go.GetComponent<MonsterIdentity>();
        if (idComp != null && idComp.entityId == currentTargetId)
            ClearTarget();
    }

    private void AttackCurrentTarget()
    {
        if (string.IsNullOrEmpty(currentTargetId)) return;
        if (!IsTargetInRange(currentTargetId)) return;
        NetworkManager.Instance.SendAttack(currentTargetId);
    }

    private bool IsTargetInRange(string targetId)
    {
        GameObject go = EntityManager.Instance.GetGameObject(targetId);
        if (go == null) return false;
        return Vector2.Distance(transform.position, go.transform.position) <= maxTargetDistance;
    }

    private void CycleToNextMonster()
    {
        monstersInRangeIds.Clear();
        Collider2D[] colliders = Physics2D.OverlapCircleAll(transform.position, maxTargetDistance);
        foreach (var col in colliders)
        {
            if (col.CompareTag("Monster"))
            {
                string id = GetEntityIdFromGameObject(col.gameObject);
                if (!string.IsNullOrEmpty(id) && !monstersInRangeIds.Contains(id))
                    monstersInRangeIds.Add(id);
            }
        }
        if (monstersInRangeIds.Count == 0)
        {
            ClearTarget();
            return;
        }
        if (string.IsNullOrEmpty(currentTargetId) || !monstersInRangeIds.Contains(currentTargetId))
        {
            SelectTarget(monstersInRangeIds[0]);
            return;
        }
        int idx = monstersInRangeIds.IndexOf(currentTargetId);
        idx = (idx + 1) % monstersInRangeIds.Count;
        SelectTarget(monstersInRangeIds[idx]);
    }

    private string GetEntityIdFromGameObject(GameObject go)
    {
        MonsterIdentity mid = go.GetComponent<MonsterIdentity>();
        if (mid != null && !string.IsNullOrEmpty(mid.entityId)) return mid.entityId;
        EntityIdentity eid = go.GetComponent<EntityIdentity>();
        return eid?.entityId;
    }

    private void AddSelectionOutline(GameObject go)
    {
        SpriteRenderer sr = go.GetComponent<SpriteRenderer>();
        if (sr != null) sr.color = new Color(1f, 0.8f, 0.8f);
    }

    private void RemoveSelectionOutline(GameObject go)
    {
        SpriteRenderer sr = go.GetComponent<SpriteRenderer>();
        if (sr != null) sr.color = Color.white;
    }
}