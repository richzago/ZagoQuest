// Assets/Resources/Scripts/Data/PlayerStatsData.cs
using System;

[Serializable]
public class PlayerStatsData
{
    public int hp;
    public int maxHp;
    public int mana;
    public int maxMana;
    public int level;
    public int attack;
    public int defense;
    public int armor;
    public int xp;
    public int xpToNext;        // XP acumulado exigido pelo próximo level
    public int levelXp;         // Progresso dentro deste level
    public int levelXpToNext;   // XP exigido dentro deste level
    public int lifetimeXp;      // Tudo o que o personagem já ganhou
}