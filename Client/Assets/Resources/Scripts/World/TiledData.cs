using System;
using System.Collections.Generic;
using UnityEngine;

[Serializable]
public class TiledMap
{
    public int width;
    public int height;
    public int tilewidth;
    public int tileheight;
    public List<TiledLayer> layers;
    public List<TiledTileset> tilesets;
}

[Serializable]
public class TiledLayer
{
    public string name;
    public string type;
    public int[] data;           // para tilelayer
    public List<TiledObject> objects; // para objectgroup
    public int width;
    public int height;
}

[Serializable]
public class TiledObject
{
    public int id;
    public string name;
    public float x;
    public float y;
    public int width;
    public int height;
    public List<TiledProperty> properties;
}

[Serializable]
public class TiledProperty
{
    public string name;
    public string type;
    public string value;
}

[Serializable]
public class TiledTileset
{
    public int firstgid;
    public string name;
    public int tilewidth;
    public int tileheight;
    public int tilecount;
    public int columns;
    public string image;
}