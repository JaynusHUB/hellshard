DUNGEON GATE - duzeltilmis paket
=================================
Haritayi Tiled'da ac: maps/dungeon_gate.json  (Tiled 1.10+; parallax icin 1.5+)

Bu surumde duzeltilenler:
- Parallax 1 - Sky katmaninin kayan 0.5/-0.5 piksel ofseti sifirlandi.
- "Grass_background_2" arka plan resmi Main Layer'a tile olarak damgalanmisti: silindi
  (arka planlar resim katmani olarak kalir, tile olarak degil).
- Heykel icin eklenen tilesetin gorseli .aseprite idi (tarayici cizemez): PNG'ye cevrildi
  (tilesets/dungeon_pack_sheet.png). Heykel yerinde duruyor.
- Zemine gomulu pickup'lar yukari alindi.

Kural: arka plan = "Parallax N" resim katmani (tile degil). Tile katmanlarinda sadece 16x16 gridli tilesetler kullan.
Tiled'da katman ofset aracini (4 yonlu ok) kullanma; katman kayarsa Ozellikler > Katman > Ofset'i 0 yap.
